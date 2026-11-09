/**
 * Runs the schema script @y/hub ships (`bin/init-db.js`) until it succeeds:
 * the init-db job of the helm chart, which has to wait for a postgres server
 * that nothing in the chart creates.
 *
 *   node dist/init-db.js --attempts=60 --delay-seconds=5
 *
 * It replaces a shell loop, the production image having no shell. Each attempt
 * is a child process: the script awaits at top level and ends with
 * `process.exit`, so it cannot be imported twice. It is idempotent, so a run
 * after a partial one is safe.
 */
import { type ChildProcess, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { logger } from '@y/hub';

const log = logger.child({ module: 'init-db-retry' });

export interface RetryOptions {
  attempts: number;
  delaySeconds: number;
}

// Refused rather than guessed, like the settings of config.ts: `Number()` reads
// a typo as NaN, and a loop bounded by NaN never gives up. Both accept what the
// shell loop this replaces did: 0 attempts still runs the script once, and
// `sleep` took a fractional delay.
const numOption = (name: string, raw: string, integer: boolean): number => {
  const value = Number(raw);
  const valid = integer ? Number.isInteger(value) : Number.isFinite(value);
  if (raw.trim() === '' || !valid || value < 0) {
    const kind = integer ? 'an integer' : 'a number';
    throw new Error(`--${name} must be ${kind} >= 0 (got "${raw}")`);
  }
  return value;
};

// The longest timer node runs: above it, it waits 1 ms instead.
const MAX_DELAY_SECONDS = Math.floor((2 ** 31 - 1) / 1000);

/** Reads `--attempts` and `--delay-seconds`, defaulting to the chart's values. */
export const parseOptions = (args: string[]): RetryOptions => {
  const { values } = parseArgs({
    args,
    options: {
      attempts: { type: 'string', default: '60' },
      'delay-seconds': { type: 'string', default: '5' },
    },
  });
  const attempts = numOption('attempts', values.attempts, true);
  const delaySeconds = numOption(
    'delay-seconds',
    values['delay-seconds'],
    false,
  );
  if (delaySeconds > MAX_DELAY_SECONDS) {
    throw new Error(
      `--delay-seconds must be at most ${MAX_DELAY_SECONDS} (got "${delaySeconds}")`,
    );
  }
  return { attempts, delaySeconds };
};

/** The script of the installed @y/hub, which does not export its `bin/`. */
export const initDbScript = (): string =>
  join(
    dirname(createRequire(import.meta.url).resolve('@y/hub/package.json')),
    'bin',
    'init-db.js',
  );

/** Runs the script once; resolves to whether it exited 0. */
export type RunOnce = () => Promise<boolean>;

let running: ChildProcess | undefined;

const runScript =
  (script: string): RunOnce =>
  () =>
    new Promise((resolve) => {
      running = spawn(process.execPath, [script], { stdio: 'inherit' });
      running.on('error', (err) => {
        log.error({ err }, 'cannot start init-db');
        resolve(false);
      });
      running.on('close', (code) => {
        running = undefined;
        resolve(code === 0);
      });
    });

/** Resolves to whether one of the attempts succeeded; 0 attempts runs once. */
export const initDbWithRetries = async (
  { attempts, delaySeconds }: RetryOptions,
  runOnce: RunOnce,
  wait: (ms: number) => Promise<unknown> = sleep,
): Promise<boolean> => {
  for (let attempt = 1; ; attempt++) {
    if (await runOnce()) return true;
    if (attempt >= attempts) {
      log.error({ attempts }, 'init-db still failing, giving up');
      return false;
    }
    log.warn(
      { attempt, attempts, delaySeconds },
      'init-db failed, the database may not be ready yet: retrying',
    );
    await wait(delaySeconds * 1000);
  }
};

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  // node is PID 1 in the container, where a signal without a handler is
  // ignored: without these, deleting the job would wait out its grace period
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      running?.kill(signal);
      process.exit(1);
    });
  }
  const options = parseOptions(process.argv.slice(2));
  const ok = await initDbWithRetries(options, runScript(initDbScript()));
  process.exit(ok ? 0 : 1);
}
