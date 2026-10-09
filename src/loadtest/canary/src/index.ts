#!/usr/bin/env node
/**
 * The command line: a few pairs of real browsers, looping on the documents of
 * the manifest for `--duration` seconds. Progress on stderr, the report on
 * stdout (or `--report`), the metrics on `--metrics-port`.
 */
import { writeFileSync } from 'node:fs';

import { chromium } from 'playwright';

import { Pair, documentFor } from './canary.js';
import type { IterationResult } from './canary.js';
import { parseConfig } from './config.js';
import { readManifest } from './manifest.js';
import type { Manifest } from './manifest.js';
import { pairsRunning, startMetricsServer } from './metrics.js';
import { Samples } from './stats.js';

const log = (line: string) =>
  process.stderr.write(`${new Date().toISOString()} ${line}\n`);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const main = async (): Promise<number> => {
  const config = parseConfig(process.argv.slice(2));
  const manifest: Manifest | null = config.manifest
    ? readManifest(config.manifest)
    : null;
  if (config.metricsPort > 0) {
    await startMetricsServer(config.metricsPort, config.metricsToken);
    log(`metrics on :${config.metricsPort}/metrics`);
  }
  const samples = {
    pageOpen: new Samples(),
    editorReady: new Samples(),
    propagation: new Samples(),
  };
  const browser = await chromium.launch({ headless: config.headless });
  let stopping = false;
  const stop = () => {
    log('stopping');
    stopping = true;
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  const pairs: Pair[] = [];
  const warnings: string[] = [];
  for (let id = 0; id < config.pairs; id++) {
    const session = manifest
      ? manifest.sessions[id % manifest.sessions.length]
      : null;
    const doc = documentFor(config, session, manifest, id);
    if (!doc) {
      warnings.push(`pair ${id}: no document to open, skipped`);
      continue;
    }
    pairs.push(
      new Pair({
        id,
        config,
        session,
        cookieName: manifest?.cookie_name ?? '',
        doc,
        samples,
        log,
      }),
    );
  }
  if (manifest && config.pairs > manifest.sessions.length) {
    warnings.push(
      `${config.pairs} pairs for ${manifest.sessions.length} sessions: some users are logged in several times`,
    );
  }

  const startedAt = new Date();
  const until = Date.now() + config.duration * 1000;
  const results: IterationResult[] = [];
  const runPair = async (pair: Pair) => {
    try {
      await pair.open(browser);
    } catch (err) {
      const message =
        err instanceof Error ? err.message.split('\n')[0] : String(err);
      warnings.push(
        `pair ${pair.options.id}: could not open the document for the reader: ${message}`,
      );
      log(`pair ${pair.options.id}: ${message}`);
      return;
    }
    pairsRunning.inc();
    try {
      while (!stopping && Date.now() < until) {
        const result = await pair.iterate();
        results.push(result);
        log(
          `pair ${pair.options.id}: ` +
            (result.failedStep
              ? `FAILED at ${result.failedStep}: ${result.error}`
              : `open ${result.pageOpen?.toFixed(2)}s, ready ${result.editorReady?.toFixed(2)}s, propagation ${result.propagation?.toFixed(2)}s`),
        );
        await sleep(config.interval * 1000);
      }
    } finally {
      pairsRunning.dec();
      await pair.close();
    }
  };
  log(
    `starting: ${pairs.length} pair(s) on ${new Set(pairs.map((p) => p.options.doc)).size} document(s), for ${config.duration}s`,
  );
  await Promise.all(pairs.map(runPair));
  await browser.close();

  const { metricsToken: _token, ...publicConfig } = config;
  const failed = results.filter((r) => r.failedStep);
  const report = {
    config: publicConfig,
    startedAt: startedAt.toISOString(),
    endedAt: new Date().toISOString(),
    pairs: pairs.length,
    iterations: results.length,
    failed: failed.length,
    failedSteps: failed.reduce<Record<string, number>>((acc, r) => {
      acc[r.failedStep ?? 'unknown'] =
        (acc[r.failedStep ?? 'unknown'] ?? 0) + 1;
      return acc;
    }, {}),
    pageOpen: samples.pageOpen.summary(),
    editorReady: samples.editorReady.summary(),
    propagation: samples.propagation.summary(),
    warnings,
  };
  const text = JSON.stringify(report, null, 2);
  if (config.report === '-') process.stdout.write(`${text}\n`);
  else writeFileSync(config.report, text);
  for (const warning of warnings) log(`warning: ${warning}`);
  log(`done: ${results.length} iterations, ${failed.length} failed`);
  return results.length > 0 && failed.length === 0 ? 0 : 1;
};

main().then(
  (code) => process.exit(code),
  (err) => {
    process.stderr.write(`${err instanceof Error ? err.message : err}\n`);
    process.exit(2);
  },
);
