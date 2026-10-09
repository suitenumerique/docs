#!/usr/bin/env node
/**
 * The command line. Progress goes to stderr, the report to `--report` (stdout
 * by default), the metrics to `--metrics-port`.
 */
import { writeFileSync } from 'node:fs';

import { parseConfig } from './config.js';
import { readManifest } from './manifest.js';
import { startMetricsServer } from './metrics.js';
import { Swarm } from './swarm.js';

const log = (line: string) =>
  process.stderr.write(`${new Date().toISOString()} ${line}\n`);

const main = async (): Promise<number> => {
  // y-websocket registers one `exit` listener per provider, and Node warns past
  // ten of them: thousands are expected here
  process.setMaxListeners(0);
  const config = parseConfig(process.argv.slice(2));
  const manifest = readManifest(config.manifest);
  if (config.metricsPort > 0) {
    await startMetricsServer(config.metricsPort, config.metricsToken);
    log(`metrics on :${config.metricsPort}/metrics`);
  }
  const swarm = new Swarm(config, manifest);
  process.on('SIGINT', () => {
    log('interrupted: stopping');
    swarm.stop();
  });
  process.on('SIGTERM', () => swarm.stop());
  log(
    `starting: ${config.clients} clients, mode ${config.mode}, ramp ${config.ramp}/s, ` +
      `hold ${config.duration}s, writers ${config.writers}`,
  );
  const report = await swarm.run(log);
  const text = JSON.stringify(report, null, 2);
  if (config.report === '-') process.stdout.write(`${text}\n`);
  else writeFileSync(config.report, text);
  for (const warning of report.warnings) log(`warning: ${warning}`);
  log(
    `done: ${report.connected}/${report.clients} connected, ${report.edits} edits, ` +
      `${report.convergence.converged}/${report.convergence.documents} documents converged`,
  );
  return report.convergence.diverged.length === 0 &&
    report.connected === report.clients
    ? 0
    : 1;
};

main().then(
  (code) => process.exit(code),
  (err) => {
    process.stderr.write(`${err instanceof Error ? err.message : err}\n`);
    process.exit(2);
  },
);
