/**
 * What the canary measures, served on /metrics for the Prometheus of the
 * campaign and summarised in the final report: the numbers a user would feel.
 */
import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { createServer } from 'node:http';

import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

export const registry = new Registry();

const SECONDS = [
  0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5, 7.5, 10, 15, 20, 30, 60,
];

export const pageOpen = new Histogram({
  name: 'canary_page_open_seconds',
  help: 'From the navigation to the editor being visible',
  buckets: SECONDS,
  registers: [registry],
});
export const editorReady = new Histogram({
  name: 'canary_editor_ready_seconds',
  help: 'From the navigation to the editor accepting input (the collaboration provider synced)',
  buckets: SECONDS,
  registers: [registry],
});
export const propagation = new Histogram({
  name: 'canary_propagation_seconds',
  help: 'From a keystroke in one browser to the text showing in another browser on the same document',
  buckets: SECONDS,
  registers: [registry],
});
export const iterations = new Counter({
  name: 'canary_iterations_total',
  help: 'Iterations, by result',
  labelNames: ['result'] as const,
  registers: [registry],
});
export const failures = new Counter({
  name: 'canary_failures_total',
  help: 'What failed, by step',
  labelNames: ['step'] as const,
  registers: [registry],
});
export const consoleErrors = new Counter({
  name: 'canary_console_errors_total',
  help: 'Errors the pages logged to their console',
  registers: [registry],
});
export const pairsRunning = new Gauge({
  name: 'canary_pairs',
  help: 'Browser pairs running',
  registers: [registry],
});

const authorized = (req: IncomingMessage, token: string): boolean => {
  if (!token) return true;
  const presented = Buffer.from(req.headers.authorization ?? '');
  const expected = Buffer.from(`Bearer ${token}`);
  return (
    presented.length === expected.length && timingSafeEqual(presented, expected)
  );
};

export const handleMetricsRequest = async (
  req: IncomingMessage,
  res: ServerResponse,
  token: string,
): Promise<void> => {
  if ((req.url ?? '').split('?')[0] !== '/metrics') {
    res.writeHead(404).end();
    return;
  }
  if (!authorized(req, token)) {
    res.writeHead(401, { 'www-authenticate': 'Bearer' }).end();
    return;
  }
  res
    .writeHead(200, { 'content-type': registry.contentType })
    .end(await registry.metrics());
};

export const startMetricsServer = (
  port: number,
  token: string,
): Promise<Server> => {
  collectDefaultMetrics({ register: registry });
  const server = createServer((req, res) => {
    void handleMetricsRequest(req, res, token);
  });
  server.unref();
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => resolve(server));
  });
};
