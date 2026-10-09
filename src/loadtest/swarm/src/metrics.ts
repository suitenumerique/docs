/**
 * What the swarm measures about itself, served on /metrics for the Prometheus of
 * the campaign and summarised in the final report.
 *
 * Every client-side number the plan asks for is here: time to connect, time to
 * the first sync, edit propagation latency (a writer stamps the time into the
 * document, every other client of that document measures the delay when it
 * arrives), reconnections, close codes, bytes.
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

const LATENCY_BUCKETS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60,
];

export const clientsByState = new Gauge({
  name: 'swarm_clients',
  help: 'Virtual clients, by the state of their websocket',
  labelNames: ['state'] as const,
  registers: [registry],
});
export const connectDuration = new Histogram({
  name: 'swarm_connect_duration_seconds',
  help: 'Time from asking for a connection to the socket being open',
  buckets: LATENCY_BUCKETS,
  registers: [registry],
});
export const syncDuration = new Histogram({
  name: 'swarm_sync_duration_seconds',
  help: 'Time from the socket being open to the first sync of the document',
  buckets: LATENCY_BUCKETS,
  registers: [registry],
});
export const propagationLatency = new Histogram({
  name: 'swarm_propagation_latency_seconds',
  help: 'Time for an edit to reach another client of the same document',
  buckets: LATENCY_BUCKETS,
  registers: [registry],
});
export const editsTotal = new Counter({
  name: 'swarm_edits_total',
  help: 'Edits the writers made',
  registers: [registry],
});
export const updatesReceivedTotal = new Counter({
  name: 'swarm_updates_received_total',
  help: 'Document updates received from the server',
  registers: [registry],
});
export const messagesTotal = new Counter({
  name: 'swarm_ws_messages_total',
  help: 'Websocket messages, by direction',
  labelNames: ['direction'] as const,
  registers: [registry],
});
export const bytesTotal = new Counter({
  name: 'swarm_ws_bytes_total',
  help: 'Websocket payload bytes, by direction',
  labelNames: ['direction'] as const,
  registers: [registry],
});
export const reconnectsTotal = new Counter({
  name: 'swarm_reconnects_total',
  help: 'Connections opened after the first one of a client',
  registers: [registry],
});
export const closesTotal = new Counter({
  name: 'swarm_ws_closes_total',
  help: 'Websocket closes, by close code',
  labelNames: ['code'] as const,
  registers: [registry],
});
export const errorsTotal = new Counter({
  name: 'swarm_errors_total',
  help: 'Errors, by kind',
  labelNames: ['kind'] as const,
  registers: [registry],
});
export const upgradeFailuresTotal = new Counter({
  name: 'swarm_upgrade_failures_total',
  help: 'Websocket upgrades refused, by http status',
  labelNames: ['status'] as const,
  registers: [registry],
});

let defaultsCollected = false;

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
  if (!defaultsCollected) {
    // the event loop lag of the swarm itself: past a point the load generator
    // is what is saturated, and its numbers stop meaning anything
    collectDefaultMetrics({ register: registry });
    defaultsCollected = true;
  }
  const server = createServer((req, res) => {
    void handleMetricsRequest(req, res, token);
  });
  server.unref();
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => resolve(server));
  });
};
