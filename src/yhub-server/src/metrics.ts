/**
 * Prometheus metrics of this process, and the http listener that serves them.
 *
 * The listener is separate from yhub's own server on purpose. The worker role
 * binds no port, so a route under /collaboration/ would leave the persistence
 * half — the one a load test most needs to see — without metrics; and what is
 * under /collaboration/ is what an ingress publishes. It answers `GET` on
 * PROMETHEUS_METRICS_PATH and nothing else, to a caller presenting
 * PROMETHEUS_API_KEY as a bearer token: the contract of the backend's /metrics.
 *
 * The metrics are defined whether or not they are served — an increment costs
 * nothing worth a branch at every call site. What is only done when they are
 * enabled is what has a cost of its own: the node runtime collectors and the
 * listener (`startMetricsServer`).
 *
 * No label ever carries a document or a user: a label value is a time series,
 * and there are as many of those as there are documents.
 */
import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import { hostname } from 'node:os';

import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

import {
  PROMETHEUS_API_KEY,
  PROMETHEUS_METRICS_PATH,
  PROMETHEUS_METRICS_PORT,
  ROLE,
  RUNS_SERVER,
  RUNS_WORKER,
} from './config.js';
import type { YHub } from './yhub.js';

export const registry = new Registry();
// A scrape that goes through a load balancer is answered by a different replica
// each time: the hostname keeps their series apart, so that a counter never
// jumps from the numbers of one replica to those of another.
registry.setDefaultLabels({ hostname: hostname(), role: ROLE });

// Upgrades and backend calls answer in milliseconds when all is well and in
// tens of seconds when the backend is drowning; both ends have to be readable.
const LATENCY_BUCKETS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60,
];
// A compaction merges a whole document: seconds are common, minutes happen.
const TASK_BUCKETS = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 300];

export const authDuration = new Histogram({
  name: 'yhub_auth_duration_seconds',
  help: 'Time spent authenticating a caller or authorizing it on a document, backend calls and legacy seed included',
  labelNames: ['phase', 'endpoint', 'result'] as const,
  buckets: LATENCY_BUCKETS,
  registers: [registry],
});

export const backendRequestDuration = new Histogram({
  name: 'yhub_backend_request_duration_seconds',
  help: 'Duration of the calls made to the Docs backend',
  labelNames: ['route', 'status'] as const,
  buckets: LATENCY_BUCKETS,
  registers: [registry],
});

export const backendRequestsInflight = new Gauge({
  name: 'yhub_backend_requests_inflight',
  help: 'Calls to the Docs backend that have not been answered yet',
  labelNames: ['route'] as const,
  registers: [registry],
});

export const workerTaskDuration = new Histogram({
  name: 'yhub_worker_task_duration_seconds',
  help: 'Duration of the compaction tasks run by this worker',
  labelNames: ['result'] as const,
  buckets: TASK_BUCKETS,
  registers: [registry],
});

export const workerTasksInflight = new Gauge({
  name: 'yhub_worker_tasks_inflight',
  help: 'Compaction tasks this worker is running',
  registers: [registry],
});

export const docUpdatesTotal = new Counter({
  name: 'yhub_doc_updates_total',
  help: 'Compactions that found new content to persist',
  registers: [registry],
});

export const seedDuration = new Histogram({
  name: 'yhub_seed_duration_seconds',
  help: 'Duration of the soft migrations of a legacy document, from the S3 read to the stream write',
  labelNames: ['result'] as const,
  buckets: LATENCY_BUCKETS,
  registers: [registry],
});

export const seedsInflight = new Gauge({
  name: 'yhub_seeds_inflight',
  help: 'Soft migrations this replica is running',
  registers: [registry],
});

export const seedRejectedTotal = new Counter({
  name: 'yhub_seed_rejected_total',
  help: 'Soft migrations refused because this replica was already running its maximum',
  registers: [registry],
});

// The routes of yhub, ours included. The label is read off the url of the
// request, which is the caller's to choose: anything else is one bucket.
const KNOWN_ENDPOINTS = new Set([
  'ws',
  'ydoc',
  'activity',
  'changeset',
  'rollback',
  'prune',
  'ping',
  'ready',
  'jwks',
  'reset-connections',
  'migrate',
  'create-ydoc',
  'restore-ydoc',
  'reset-ydoc',
]);
export const endpointLabel = (endpoint: string | undefined): string =>
  endpoint != null && KNOWN_ENDPOINTS.has(endpoint) ? endpoint : 'other';

// What a backend path is called in a label: never the path, which holds the
// document id.
export const backendRouteLabel = (path: string): string => {
  if (path.endsWith('/users/me/')) return 'users_me';
  if (path.endsWith('/accesses/me/')) return 'accesses_me';
  if (path.endsWith('/content-updated/')) return 'content_updated';
  if (/\/documents\/[^/]+\/$/.test(path)) return 'document';
  return 'other';
};

const errStatus = (err: unknown): number | undefined =>
  typeof err === 'object' &&
  err !== null &&
  'status' in err &&
  typeof (err as { status: unknown }).status === 'number'
    ? (err as { status: number }).status
    : undefined;

/**
 * Time one of the two callbacks of the auth plugin, without changing what it
 * returns or throws.
 *
 *   ok          it answered, and granted something
 *   denied      it answered no: `null` from `authorize`, a 401/403 thrown
 *   unavailable it could not answer (503): the backend, or the legacy store
 *   error       anything else
 *
 * `endpointOf` and the callback are both called before the first await: the
 * request yhub hands to `authenticate` is only valid synchronously.
 */
export const timedAuth =
  <Args extends unknown[], Result>(
    phase: 'authenticate' | 'authorize',
    endpointOf: (...args: Args) => string | undefined,
    callback: (...args: Args) => Promise<Result>,
  ) =>
  async (...args: Args): Promise<Result> => {
    const endpoint = endpointLabel(endpointOf(...args));
    const end = authDuration.startTimer({ phase, endpoint });
    try {
      const result = await callback(...args);
      end({
        result: phase === 'authorize' && result == null ? 'denied' : 'ok',
      });
      return result;
    } catch (err) {
      const status = errStatus(err);
      end({
        result:
          status === 401 || status === 403
            ? 'denied'
            : status === 503
              ? 'unavailable'
              : 'error',
      });
      throw err;
    }
  };

/**
 * Time a call to the backend. `status` is the http status, `timeout` when the
 * call was given up on, `error` when it never got an answer.
 */
export const timedBackendRequest = async (
  path: string,
  request: () => Promise<Response>,
): Promise<Response> => {
  const route = backendRouteLabel(path);
  const end = backendRequestDuration.startTimer({ route });
  backendRequestsInflight.inc({ route });
  try {
    const res = await request();
    end({ status: String(res.status) });
    return res;
  } catch (err) {
    // what `AbortSignal.timeout` aborts with: a backend that is up but too slow
    // is not the same finding as one that cannot be reached
    const timedOut = err instanceof Error && err.name === 'TimeoutError';
    end({ status: timedOut ? 'timeout' : 'error' });
    throw err;
  } finally {
    backendRequestsInflight.dec({ route });
  }
};

// What is only known by asking yhub, asked at scrape time.
const registerYhubGauges = (yhub: YHub): void => {
  if (RUNS_SERVER) {
    // `stream.subs` is yhub's own bookkeeping of who listens to which room on
    // this replica — not a published API, and read defensively for that reason:
    // a yhub that renames it costs two gauges, not the process.
    const rooms = (): Map<string, { subs?: Set<unknown> }> | undefined => {
      const subs = (yhub.stream as unknown as { subs?: unknown }).subs;
      return subs instanceof Map ? subs : undefined;
    };
    new Gauge({
      name: 'yhub_rooms',
      help: 'Documents with at least one websocket connection on this replica',
      registers: [registry],
      collect() {
        this.set(rooms()?.size ?? 0);
      },
    });
    new Gauge({
      name: 'yhub_ws_connections',
      help: 'Websocket connections subscribed to a document on this replica',
      registers: [registry],
      collect() {
        let connections = 0;
        for (const room of rooms()?.values() ?? []) {
          connections += room.subs?.size ?? 0;
        }
        this.set(connections);
      },
    });
  }
  if (RUNS_WORKER) {
    new Gauge({
      name: 'yhub_worker_pending_tasks',
      // one queue for the whole deployment: every worker reports the same
      // number, which is to be read with max(), never summed
      help: 'Compaction tasks waiting on the redis queue, for the whole deployment (use max, not sum)',
      registers: [registry],
      async collect() {
        try {
          this.set(await yhub.stream.getPendingTasksSize());
        } catch {
          // a scrape must not fail because redis blinked
        }
      },
    });
  }
};

const isAuthorized = (req: IncomingMessage): boolean => {
  if (!PROMETHEUS_API_KEY) return false;
  const presented = Buffer.from(req.headers.authorization ?? '');
  const expected = Buffer.from(`Bearer ${PROMETHEUS_API_KEY}`);
  // timingSafeEqual refuses buffers of different lengths, and the length of the
  // key is not what is being protected
  return (
    presented.length === expected.length && timingSafeEqual(presented, expected)
  );
};

export const handleMetricsRequest = async (
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> => {
  const path = (req.url ?? '').split('?')[0];
  if (path !== PROMETHEUS_METRICS_PATH) {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not Found');
    return;
  }
  // before the method: what an unauthenticated caller learns is that there is
  // a lock, not what is behind it
  if (!isAuthorized(req)) {
    res
      .writeHead(401, {
        'content-type': 'text/plain',
        'www-authenticate': 'Bearer realm="metrics"',
      })
      .end('Unauthorized');
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res
      .writeHead(405, { 'content-type': 'text/plain', allow: 'GET, HEAD' })
      .end('Method Not Allowed');
    return;
  }
  try {
    const body = await registry.metrics();
    res.writeHead(200, { 'content-type': registry.contentType }).end(body);
  } catch {
    res
      .writeHead(500, { 'content-type': 'text/plain' })
      .end('Internal Server Error');
  }
};

/**
 * Start collecting the runtime metrics and serving everything. Only called when
 * PROMETHEUS_METRICS_ENABLED is set, which `config.ts` refuses without a key.
 */
export const startMetricsServer = (yhub: YHub): Promise<Server> => {
  // event loop lag, heap, gc, cpu: one node thread serves every socket of this
  // replica, and its lag is the first thing to move when it saturates
  collectDefaultMetrics({ register: registry });
  registerYhubGauges(yhub);

  const server = createServer((req, res) => {
    void handleMetricsRequest(req, res);
  });
  // it must never be what keeps a stopping process alive
  server.unref();
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PROMETHEUS_METRICS_PORT, () => resolve(server));
  });
};
