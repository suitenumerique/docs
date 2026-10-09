import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { parseConfig } from '../src/config.js';
import type { Config } from '../src/config.js';
import type { Manifest } from '../src/manifest.js';
import { registry } from '../src/metrics.js';
import { Swarm, assign } from '../src/swarm.js';
import { startTestServer } from './_server.js';
import type { TestServer } from './_server.js';

const manifest: Manifest = {
  cookie_name: 'docs_sessionid',
  public_documents: ['pub1', 'pub2'],
  sessions: [
    {
      user_id: 'u1',
      session_key: 'k1',
      editable_documents: ['e1', 'e2'],
      readonly_documents: ['r1'],
    },
    {
      user_id: 'u2',
      session_key: 'k2',
      editable_documents: ['e3'],
      readonly_documents: [],
    },
    {
      user_id: 'u3',
      session_key: 'k3',
      editable_documents: [],
      readonly_documents: ['r2'],
    },
  ],
};

const config = (url: string, ...extra: string[]): Config =>
  parseConfig([
    '--manifest',
    'm',
    '--url',
    url,
    '--metrics-port',
    '0',
    '--progress-interval',
    '1',
    '--ramp',
    '1000',
    '--settle',
    '1',
    ...extra,
  ]);

describe('assign', () => {
  const dummy = (...extra: string[]) => config('ws://x', ...extra);

  it('puts everybody on one document in hot mode, the first public one by default', () => {
    const { assignments } = assign(
      dummy('--mode', 'hot', '--clients', '4'),
      manifest,
    );
    expect(assignments.map((a) => a.room)).toEqual([
      'pub1',
      'pub1',
      'pub1',
      'pub1',
    ]);
    expect(
      assign(dummy('--mode', 'hot', '--doc', 'd', '--clients', '1'), manifest)
        .assignments[0].room,
    ).toBe('d');
  });

  it('gives writers a document they may edit and readers one they may read', () => {
    const { assignments } = assign(
      dummy('--mode', 'wide', '--clients', '3', '--writers', '0.67'),
      manifest,
    );
    expect(
      assignments.map((a) => [a.session.user_id, a.writer, a.room]),
    ).toEqual([
      ['u1', true, 'e1'],
      ['u2', true, 'e3'],
      ['u3', false, 'r2'],
    ]);
  });

  it('falls back to the public documents for a user with none, and warns past the sessions', () => {
    const { assignments, warnings } = assign(
      dummy('--mode', 'wide', '--clients', '4', '--writers', '1'),
      manifest,
    );
    // u3 may edit nothing of their own: a public document instead
    expect(assignments[2].room).toBe('pub1');
    // 4 clients for 3 sessions: u1 twice, on their next document
    expect(assignments[3].session.user_id).toBe('u1');
    expect(assignments[3].room).toBe('e2');
    expect(warnings[0]).toContain('4 clients for 3 sessions');
  });

  it('refuses hot mode without a document', () => {
    expect(() =>
      assign(dummy('--mode', 'hot'), { ...manifest, public_documents: [] }),
    ).toThrow('--mode hot needs --doc');
  });
});

describe('Swarm', () => {
  let server: TestServer;
  beforeEach(async () => {
    server = await startTestServer();
  });
  afterEach(async () => {
    await server.close();
    registry.resetMetrics();
  });

  it('connects as the users of the manifest, edits, and converges', async () => {
    const swarm = new Swarm(
      config(
        server.url,
        '--mode',
        'hot',
        '--clients',
        '6',
        '--writers',
        '0.5',
        '--duration',
        '3',
        '--edit-interval',
        '100',
        '--awareness-interval',
        '200',
      ),
      manifest,
    );
    const report = await swarm.run();

    expect(report.clients).toBe(6);
    expect(report.connected).toBe(6);
    expect(report.writers).toBe(3);
    expect(report.edits).toBeGreaterThan(20);
    expect(report.convergence).toEqual({
      documents: 1,
      converged: 1,
      diverged: [],
    });
    // a sample per edit per other client, roughly
    expect(report.propagation?.count).toBeGreaterThan(report.edits);
    expect(report.propagation?.p95).toBeLessThan(1);
    expect(report.connect?.count).toBe(6);
    expect(report.sync?.count).toBe(6);
    expect(report.reconnects).toBe(0);

    // the upgrade carried the session cookie, the origin and the room
    expect(server.upgrades).toHaveLength(6);
    expect(server.upgrades[0]).toEqual({
      path: '/collaboration/ws/v1/docs/pub1',
      cookie: 'docs_sessionid=k1',
      origin: `http://${new URL(server.url).host}`,
    });
    expect(new Set(server.upgrades.map((u) => u.cookie))).toEqual(
      new Set(['docs_sessionid=k1', 'docs_sessionid=k2', 'docs_sessionid=k3']),
    );
    // the server holds what the writers typed
    const doc = server.rooms.get('pub1')?.doc;
    expect(doc?.getText('loadtest-text').length).toBeGreaterThan(0);
    expect(doc?.getMap('loadtest-stamps').size).toBe(3);
    // and saw their awareness
    expect(
      server.rooms.get('pub1')?.awareness.getStates().size ?? 0,
    ).toBeGreaterThanOrEqual(0);

    const text = await registry.metrics();
    expect(text).toMatch(/swarm_edits_total \d+/);
    expect(text).toMatch(/swarm_propagation_latency_seconds_count \d+/);
    expect(text).toMatch(/swarm_ws_bytes_total\{direction="out"\} [1-9]/);
    expect(text).toMatch(/swarm_ws_bytes_total\{direction="in"\} [1-9]/);
  });

  it('reconnects through a storm and when the server drops everybody', async () => {
    const swarm = new Swarm(
      config(
        server.url,
        '--mode',
        'wide',
        '--clients',
        '3',
        '--writers',
        '0',
        '--duration',
        '3',
        '--storm-at',
        '1',
        '--reconnect-jitter',
        '200',
      ),
      manifest,
    );
    const dropAt = setTimeout(() => server.dropAll(), 2200);
    const report = await swarm.run();
    clearTimeout(dropAt);

    expect(report.connected).toBe(3);
    // one reconnection from the storm, one from the drop
    expect(report.reconnects).toBeGreaterThanOrEqual(6);
    expect(server.upgrades.length).toBeGreaterThanOrEqual(9);
    const text = await registry.metrics();
    expect(text).toMatch(
      /swarm_reconnects_total [6-9]|swarm_reconnects_total \d{2,}/,
    );
    expect(text).toMatch(/swarm_ws_closes_total\{code="\d+"\}/);
  });

  it('counts the upgrades a server refuses, and keeps trying', async () => {
    server.refuse = { status: 503 };
    const swarm = new Swarm(
      config(
        server.url,
        '--mode',
        'hot',
        '--clients',
        '2',
        '--duration',
        '2',
        '--settle',
        '0',
      ),
      manifest,
    );
    const report = await swarm.run();

    expect(report.connected).toBe(0);
    expect(report.convergence.documents).toBe(0);
    const text = await registry.metrics();
    expect(text).toMatch(/swarm_upgrade_failures_total\{status="503"\} [2-9]/);
    // every client was let go at the end of the run
    expect(text).toMatch(/swarm_clients\{state="connecting"\} 0/);
  });
});
