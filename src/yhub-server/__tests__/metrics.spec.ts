// metrics.ts — the metric helpers and the http listener, tested without yhub:
// the helpers are plain functions over the registry, and the listener's handler
// is driven through a real `node:http` server on a port of the system's choosing.

import type { AddressInfo } from 'node:net';
import { createServer } from 'node:http';
import type { Server } from 'node:http';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const API_KEY = 'test-prometheus-api-key';

const load = () => import('../src/metrics.js');

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.stubEnv('PROMETHEUS_METRICS_ENABLED', 'true');
  vi.stubEnv('PROMETHEUS_API_KEY', API_KEY);
  vi.stubEnv('PROMETHEUS_API_KEY_FILE', '');
  vi.stubEnv('PROMETHEUS_METRICS_PATH', '');
  vi.stubEnv('PROMETHEUS_METRICS_PORT', '');
  vi.stubEnv('YHUB_ROLE', '');
});

describe('labels', () => {
  it('never lets the caller choose an endpoint label', async () => {
    const { endpointLabel } = await load();
    expect(endpointLabel('ws')).toBe('ws');
    expect(endpointLabel('reset-connections')).toBe('reset-connections');
    expect(endpointLabel('made-up-by-the-caller')).toBe('other');
    expect(endpointLabel('')).toBe('other');
    expect(endpointLabel(undefined)).toBe('other');
  });

  it('names a backend route without the document id', async () => {
    const { backendRouteLabel } = await load();
    const docid = '7c0f6f4e-2b0e-4a57-9f0a-3f6f2f0d1e11';
    expect(backendRouteLabel('/api/v1.0/users/me/')).toBe('users_me');
    expect(backendRouteLabel(`/api/v1.0/documents/${docid}/`)).toBe('document');
    expect(backendRouteLabel(`/api/v1.0/documents/${docid}/accesses/me/`)).toBe(
      'accesses_me',
    );
    expect(
      backendRouteLabel(`/api/v1.0/documents/${docid}/content-updated/`),
    ).toBe('content_updated');
    expect(backendRouteLabel('/api/v1.0/something/else/')).toBe('other');
  });

  it('tells the replicas and the roles apart', async () => {
    vi.stubEnv('YHUB_ROLE', 'worker');
    const { registry, docUpdatesTotal } = await load();
    docUpdatesTotal.inc();
    expect(await registry.metrics()).toMatch(
      /yhub_doc_updates_total\{hostname="[^"]+",role="worker"\} 1/,
    );
  });
});

describe('timedAuth', () => {
  const resultsOf = async () => {
    const { authDuration } = await load();
    const { values } = await authDuration.get();
    return values
      .filter(({ metricName }) => metricName?.endsWith('_count'))
      .map(
        ({ labels }) => `${labels.phase}:${labels.endpoint}:${labels.result}`,
      );
  };
  const failure = (status?: number) =>
    Object.assign(new Error('boom'), status == null ? {} : { status });

  it('passes the answer through and counts it as ok', async () => {
    const { timedAuth } = await load();
    const timed = timedAuth(
      'authenticate',
      (endpoint: string) => endpoint,
      async (endpoint: string) => ({ userid: `on ${endpoint}` }),
    );

    await expect(timed('ws')).resolves.toEqual({ userid: 'on ws' });
    expect(await resultsOf()).toEqual(['authenticate:ws:ok']);
  });

  it('reads the endpoint and calls the callback before the first await', async () => {
    const { timedAuth } = await load();
    const order: string[] = [];
    const timed = timedAuth(
      'authenticate',
      () => {
        order.push('endpoint');
        return 'ws';
      },
      async () => {
        order.push('callback');
        return null;
      },
    );

    const pending = timed();
    // nothing has been awaited yet: a uws request is still valid here
    expect(order).toEqual(['endpoint', 'callback']);
    await pending;
  });

  it('counts a null answer of authorize as a denial, not of authenticate', async () => {
    const { timedAuth } = await load();
    await timedAuth(
      'authorize',
      () => 'ydoc',
      async () => null,
    )();
    await timedAuth(
      'authenticate',
      () => 'ydoc',
      async () => null,
    )();

    expect(await resultsOf()).toEqual([
      'authorize:ydoc:denied',
      'authenticate:ydoc:ok',
    ]);
  });

  it.each([
    [401, 'denied'],
    [403, 'denied'],
    [503, 'unavailable'],
    [500, 'error'],
    [undefined, 'error'],
  ])('rethrows a %s and counts it as %s', async (status, result) => {
    const { timedAuth } = await load();
    const err = failure(status);
    const timed = timedAuth(
      'authorize',
      () => 'ws',
      async () => {
        throw err;
      },
    );

    await expect(timed()).rejects.toBe(err);
    expect(await resultsOf()).toEqual([`authorize:ws:${result}`]);
  });
});

describe('timedBackendRequest', () => {
  const samples = async () => {
    const { backendRequestDuration, backendRequestsInflight } = await load();
    const duration = await backendRequestDuration.get();
    const inflight = await backendRequestsInflight.get();
    return {
      counted: duration.values
        .filter(({ metricName }) => metricName?.endsWith('_count'))
        .map(({ labels }) => `${labels.route}:${labels.status}`),
      inflight: inflight.values.map(({ value }) => value),
    };
  };

  it('counts the answer under its route and status, and is in flight meanwhile', async () => {
    const { timedBackendRequest } = await load();
    let during: number[] = [];

    const res = await timedBackendRequest('/api/v1.0/users/me/', async () => {
      during = (await samples()).inflight;
      return new Response('{}', { status: 403 });
    });

    expect(res.status).toBe(403);
    expect(during).toEqual([1]);
    expect(await samples()).toEqual({
      counted: ['users_me:403'],
      inflight: [0],
    });
  });

  it('counts a call that never got an answer as an error', async () => {
    const { timedBackendRequest } = await load();
    const err = new Error('connect ECONNREFUSED');

    await expect(
      timedBackendRequest('/api/v1.0/users/me/', async () => {
        throw err;
      }),
    ).rejects.toBe(err);

    expect(await samples()).toEqual({
      counted: ['users_me:error'],
      inflight: [0],
    });
  });
});

describe('timedBackendRequest timeouts', () => {
  it('tells a call that was given up on from one that failed', async () => {
    const { backendRequestDuration, timedBackendRequest } = await load();
    // what `AbortSignal.timeout` aborts a fetch with
    const err = new DOMException('The operation timed out', 'TimeoutError');

    await expect(
      timedBackendRequest('/api/v1.0/users/me/', async () => {
        throw err;
      }),
    ).rejects.toBe(err);

    const { values } = await backendRequestDuration.get();
    expect(
      values
        .filter(({ metricName }) => metricName?.endsWith('_count'))
        .map(({ labels }) => `${labels.route}:${labels.status}`),
    ).toEqual(['users_me:timeout']);
  });
});

describe('the metrics listener', () => {
  let server: Server | undefined;

  const listen = async (): Promise<string> => {
    const { handleMetricsRequest } = await load();
    server = createServer((req, res) => {
      void handleMetricsRequest(req, res);
    });
    await new Promise<void>((resolve) =>
      server?.listen(0, '127.0.0.1', resolve),
    );
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  };

  afterEach(async () => {
    await new Promise((resolve) =>
      server ? server.close(resolve) : resolve(null),
    );
    server = undefined;
  });

  // no trailing-space case: http strips the whitespace around a header value,
  // so it reaches the server as the exact key
  it.each([
    undefined,
    '',
    'Bearer',
    'Bearer ',
    'Bearer wrong-key',
    `bearer ${API_KEY}`,
    `Token ${API_KEY}`,
    API_KEY,
    'Bearer clé-non-ascii',
  ])('refuses "%s"', async (authorization) => {
    const url = await listen();

    const res = await fetch(`${url}/metrics`, {
      headers: authorization == null ? {} : { authorization },
    });

    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toBe('Bearer realm="metrics"');
    expect(await res.text()).toBe('Unauthorized');
  });

  it('serves the metrics to the right key', async () => {
    const url = await listen();
    const { docUpdatesTotal } = await load();
    docUpdatesTotal.inc(3);

    const res = await fetch(`${url}/metrics?ignored=1`, {
      headers: { authorization: `Bearer ${API_KEY}` },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');
    expect(await res.text()).toMatch(/yhub_doc_updates_total\{[^}]*\} 3/);
  });

  it('serves nothing else, key or not', async () => {
    const url = await listen();
    const headers = { authorization: `Bearer ${API_KEY}` };

    for (const path of ['/', '/metrics/', '/collaboration/metrics/v1']) {
      expect((await fetch(`${url}${path}`, { headers })).status).toBe(404);
    }
    expect(
      (await fetch(`${url}/metrics`, { method: 'POST', headers })).status,
    ).toBe(405);
    // without the key, the method is not even looked at
    expect((await fetch(`${url}/metrics`, { method: 'POST' })).status).toBe(
      401,
    );
  });

  it('serves them where PROMETHEUS_METRICS_PATH says', async () => {
    vi.stubEnv('PROMETHEUS_METRICS_PATH', '/metrics/yhub-worker');
    const url = await listen();
    const headers = { authorization: `Bearer ${API_KEY}` };

    expect(
      (await fetch(`${url}/metrics/yhub-worker`, { headers })).status,
    ).toBe(200);
    expect((await fetch(`${url}/metrics`, { headers })).status).toBe(404);
  });
});

describe('startMetricsServer', () => {
  it('reports what it reads off yhub, by role', async () => {
    // a port of the system's choosing cannot be asked for: intEnv wants >= 1
    vi.stubEnv('PROMETHEUS_METRICS_PORT', '19464');
    const { registry, startMetricsServer } = await load();
    const yhub = {
      stream: {
        subs: new Map([
          ['room-a', { subs: new Set([1, 2]) }],
          ['room-b', { subs: new Set([3]) }],
        ]),
        getPendingTasksSize: async () => 7,
      },
    };

    const server = await startMetricsServer(yhub as never);
    try {
      const text = await registry.metrics();
      expect(text).toMatch(/yhub_rooms\{[^}]*\} 2/);
      expect(text).toMatch(/yhub_ws_connections\{[^}]*\} 3/);
      expect(text).toMatch(/yhub_worker_pending_tasks\{[^}]*\} 7/);
      // the node runtime collectors are on
      expect(text).toContain('nodejs_eventloop_lag_seconds');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('survives a yhub that no longer exposes its subscriptions, and a redis that blinks', async () => {
    vi.stubEnv('PROMETHEUS_METRICS_PORT', '19465');
    const { registry, startMetricsServer } = await load();
    const yhub = {
      stream: {
        getPendingTasksSize: async () => {
          throw new Error('redis is gone');
        },
      },
    };

    const server = await startMetricsServer(yhub as never);
    try {
      const text = await registry.metrics();
      expect(text).toMatch(/yhub_rooms\{[^}]*\} 0/);
      expect(text).toMatch(/yhub_ws_connections\{[^}]*\} 0/);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
