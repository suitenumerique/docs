/**
 * Integration tests — need a real Redis ≥ 7 and PostgreSQL:
 *
 *   docker run -d -p 16379:6379 redis:7
 *   docker run -d -p 15432:5432 -e POSTGRES_USER=yhub -e POSTGRES_PASSWORD=yhub \
 *     -e POSTGRES_DB=yhub postgres:16-alpine
 *
 * Override with REDIS_URL / POSTGRES_URL. Run with `yarn test:integration`.
 */
import { randomUUID } from 'crypto';
import { Server } from 'http';
import { AddressInfo } from 'net';

import express from 'express';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { WebSocket as WS } from 'ws';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';

// Must be set before '@/env' is imported (hence the dynamic import below).
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:16379';
process.env.POSTGRES_URL =
  process.env.POSTGRES_URL ?? 'postgres://yhub:yhub@localhost:15432/yhub';
process.env.YHUB_REDIS_PREFIX = `int-${randomUUID().slice(0, 8)}`;
process.env.YHUB_INTERNAL_PORT = '14545';
process.env.YHUB_TASK_DEBOUNCE = '700';
process.env.YHUB_MIN_MESSAGE_LIFETIME = '1500';

const ORIGIN = 'http://localhost:3000';
const SECRET = 'secret-api-key';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitFor = async (
  condition: () => boolean | Promise<boolean>,
  what: string,
  timeoutMs = 10_000,
) => {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition())) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for: ${what}`);
    }
    await sleep(50);
  }
};

type Gateway = Awaited<ReturnType<(typeof import('@/boot'))['bootGateway']>>;

describe('collaboration through the gateway (integration)', () => {
  let gateway: Gateway;
  let gatewayPort: number;
  let djangoStub: Server;
  const providers: WebsocketProvider[] = [];

  /** Stub Django: cookie `mode=read` → read-only, `mode=none` → no access. */
  const startDjangoStub = async () => {
    const app = express();
    app.get('/api/v1.0/documents/:id/', (req, res) => {
      const cookie = req.headers.cookie ?? '';
      if (cookie.includes('mode=none')) {
        res.status(403).json({ detail: 'forbidden' });
        return;
      }
      res.json({
        id: req.params.id,
        abilities: { retrieve: true, update: !cookie.includes('mode=read') },
      });
    });
    app.get('/api/v1.0/users/me/', (req, res) => {
      const match = /uid=([^;]+)/.exec(req.headers.cookie ?? '');
      if (!match) {
        res.status(401).json({ detail: 'unauthenticated' });
        return;
      }
      res.json({ id: match[1], email: `${match[1]}@example.com` });
    });
    djangoStub = app.listen(0);
    await new Promise((resolve) => djangoStub.once('listening', resolve));
    const { port } = djangoStub.address() as AddressInfo;
    process.env.COLLABORATION_BACKEND_BASE_URL = `http://127.0.0.1:${port}`;
  };

  const connect = (room: string, cookie: string) => {
    const doc = new Y.Doc();
    class WSWithHeaders extends WS {
      constructor(url: string, protocols?: string | string[]) {
        super(url, protocols, { headers: { origin: ORIGIN, cookie } });
      }
    }
    const provider = new WebsocketProvider(
      `ws://127.0.0.1:${gatewayPort}/collaboration/ws`,
      room,
      doc,
      {
        WebSocketPolyfill: WSWithHeaders as unknown as typeof WebSocket,
        disableBc: true,
      },
    );
    providers.push(provider);
    return { doc, provider };
  };

  const gatewayHttp = (path: string, init?: RequestInit) =>
    fetch(`http://127.0.0.1:${gatewayPort}${path}`, {
      ...init,
      headers: { Authorization: SECRET, ...(init?.headers ?? {}) },
    });

  beforeAll(async () => {
    await startDjangoStub();
    const { bootGateway } = await import('@/boot');
    gateway = await bootGateway();
    await new Promise<void>((resolve) => gateway.server.listen(0, resolve));
    gatewayPort = (gateway.server.address() as AddressInfo).port;
  }, 30_000);

  afterAll(async () => {
    providers.forEach((provider) => provider.destroy());
    await gateway?.shutdown();
    djangoStub?.close();
  }, 30_000);

  test('two clients sync edits and awareness; read-only edits are dropped; kick and purge behave', async () => {
    const room = randomUUID();

    // --- two read-write clients sync both ways
    const a = connect(room, 'docs_sessionid=sessA; uid=userA');
    const b = connect(room, 'docs_sessionid=sessB; uid=userB');
    await waitFor(() => a.provider.synced && b.provider.synced, 'initial sync');

    a.doc.getText('content').insert(0, 'hello');
    await waitFor(
      () => b.doc.getText('content').toString() === 'hello',
      'A→B propagation',
    );
    b.doc.getText('content').insert(5, ' world');
    await waitFor(
      () => a.doc.getText('content').toString() === 'hello world',
      'B→A propagation',
    );

    // --- awareness propagates
    a.provider.awareness.setLocalStateField('user', { name: 'Alice' });
    await waitFor(
      () =>
        [...b.provider.awareness.getStates().values()].some(
          (state) =>
            (state as { user?: { name?: string } }).user?.name === 'Alice',
        ),
      'awareness propagation',
    );

    // --- read-only client: receives but cannot write
    const r = connect(room, 'docs_sessionid=sessR; uid=userR; mode=read');
    await waitFor(
      () => r.doc.getText('content').toString() === 'hello world',
      'read-only client receives state',
    );
    r.doc.getText('content').insert(0, 'EVIL-');
    await sleep(700);
    expect(a.doc.getText('content').toString()).toBe('hello world');

    // --- get-connections: counts rw connections only, sessionKey matching
    const connectionsResponse = await gatewayHttp(
      `/collaboration/api/get-connections/?room=${room}&sessionKey=sessA`,
    );
    expect(connectionsResponse.status).toBe(200);
    expect(await connectionsResponse.json()).toEqual({
      count: 2,
      exists: true,
    });
    const strangerResponse = await gatewayHttp(
      `/collaboration/api/get-connections/?room=${room}&sessionKey=nope`,
    );
    expect(
      (await strangerResponse.json()) as { exists: boolean },
    ).toMatchObject({
      exists: false,
    });

    // --- user-scoped kick: only userB is closed, with code 4000
    const closeCodes: number[] = [];
    b.provider.on('connection-close', (event: { code?: number } | null) => {
      if (event?.code) {
        closeCodes.push(event.code);
      }
    });
    const resetResponse = await gatewayHttp(
      `/collaboration/api/reset-connections/?room=${room}`,
      { method: 'POST', headers: { 'X-User-Id': 'userB' } },
    );
    expect(resetResponse.status).toBe(200);
    await waitFor(() => closeCodes.includes(4000), 'kick close code 4000');
    expect(a.provider.wsconnected).toBe(true); // userA untouched

    // --- disposable cache: disconnect everyone, then a fresh join purges
    providers.forEach((provider) => provider.destroy());
    providers.length = 0;
    await waitFor(async () => {
      const response = await gatewayHttp(
        `/collaboration/api/get-connections/?room=${room}&sessionKey=x`,
      );
      return response.status === 404;
    }, 'all connections deregistered');

    // wait until the worker compacted the session into Postgres
    await waitFor(
      async () => {
        const rows = await gateway.yhub.persistence.sql`
        SELECT count(*)::int AS count FROM yhub_ydoc_v1 WHERE docid = ${room}
      `;
        return (rows[0] as { count: number }).count > 0;
      },
      'worker compaction persisted rows',
      15_000,
    );

    const fresh = connect(room, 'docs_sessionid=sessC; uid=userC');
    await waitFor(() => fresh.provider.synced, 'fresh client sync');
    // the previous session's content is gone: the cache was purged on 0→1
    expect(fresh.doc.getText('content').toString()).toBe('');
    const rowsAfter = await gateway.yhub.persistence.sql`
      SELECT count(*)::int AS count FROM yhub_ydoc_v1 WHERE docid = ${room}
    `;
    expect((rowsAfter[0] as { count: number }).count).toBe(0);
  }, 60_000);

  test('no-access user is rejected at the gateway', async () => {
    const room = randomUUID();
    const outcome = await new Promise<string>((resolve) => {
      const ws = new WS(
        `ws://127.0.0.1:${gatewayPort}/collaboration/ws/${room}`,
        { headers: { origin: ORIGIN, cookie: 'docs_sessionid=x; mode=none' } },
      );
      const timer = setTimeout(() => {
        ws.terminate();
        resolve('timeout');
      }, 4000);
      ws.on('error', () => undefined); // aborted handshakes also emit 'error'
      ws.on('unexpected-response', (_request, response) => {
        clearTimeout(timer);
        ws.terminate();
        resolve(`http-${response.statusCode}`);
      });
      ws.on('open', () => {
        clearTimeout(timer);
        ws.close();
        resolve('open');
      });
    });
    expect(outcome).toBe('http-403');
  }, 15_000);
});
