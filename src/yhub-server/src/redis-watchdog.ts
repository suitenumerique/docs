/**
 * Restart this process when a failover has left its redis connections on a
 * read-only node, as soon as a new connection would reach a writable primary.
 *
 * yhub's clients only reconnect when their socket drops, and @y/hub offers no
 * way to reconnect them: after a Sentinel failover they can stay on the
 * demoted node, which refuses every update with `READONLY`, until the process
 * restarts. A restart is not enough on its own, though: the Service the URL
 * names follows the new primary only when the operator relabels the pods,
 * a minute or more later. Restarting before that lands on the old node again.
 * So the watchdog opens a fresh connection through the same URL, and restarts
 * only once that one can write.
 *
 * Runs in every role: the worker has no probes, so this is its only way out.
 */
import { logger } from '@y/hub';

import { READINESS_TIMEOUT_MS } from './config.js';
import { probeRedis, type RedisHealth } from './redis-health.js';
import type { YHub } from './yhub.js';

export const WATCHDOG_INTERVAL_MS = 5_000;
// How long the websockets get to acknowledge their 4503 before the exit.
export const RESTART_DRAIN_MS = 5_000;
// The most a restart waits on yhub's shutdown, which closes clients that sit
// on a node that may not answer.
export const RESTART_TIMEOUT_MS = 15_000;

const watchdogLog = logger.child({ module: 'redis-watchdog' });

/**
 * Where a new connection through the same URL lands now. Same options as
 * yhub's own client, but a short connect timeout and no retries: yhub's
 * strategy retries for minutes and then exits the process.
 */
export const probeFreshConnection = async (
  yhub: YHub,
): Promise<RedisHealth> => {
  const { redis, prefix } = yhub.stream;
  const fresh = redis.duplicate({
    socket: {
      ...redis.options?.socket,
      connectTimeout: READINESS_TIMEOUT_MS,
      reconnectStrategy: false,
    },
  });
  // a client with no 'error' listener turns a failed connection into an
  // uncaught exception
  fresh.on('error', () => {});
  // `connectTimeout` only bounds the TCP connection: node-redis drops it
  // before the handshake, which a stalled node accepts and never answers.
  // This deadline covers both. On expiry the client is destroyed below, which
  // makes the abandoned `connect()` reject: nothing must be left to see it.
  const connecting = fresh.connect();
  connecting.catch(() => {});
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      connecting,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`no handshake in ${READINESS_TIMEOUT_MS}ms`)),
          READINESS_TIMEOUT_MS,
        );
      }),
    ]);
    return await probeRedis(fresh, prefix);
  } catch {
    return 'unreachable';
  } finally {
    clearTimeout(timer);
    // destroying a client that never opened throws
    if (fresh.isOpen) fresh.destroy();
  }
};

const restart = async (yhub: YHub, exit: (code: number) => void) => {
  watchdogLog.error(
    'redis only accepts reads on this process connections, while a new ' +
      'connection can write: restarting to reconnect',
  );
  let timer: NodeJS.Timeout | undefined;
  await Promise.race([
    yhub.destroy({ drainMs: RESTART_DRAIN_MS }).catch((err: unknown) => {
      watchdogLog.error({ err }, 'shutdown before the restart failed');
    }),
    new Promise((resolve) => {
      timer = setTimeout(resolve, RESTART_TIMEOUT_MS);
    }),
  ]);
  clearTimeout(timer);
  exit(1);
};

/**
 * Check every `WATCHDOG_INTERVAL_MS`, one check at a time. Returns a function
 * that stops it. `exit` is the way out, swapped in tests.
 */
export const startRedisWatchdog = (
  yhub: YHub,
  exit: (code: number) => void = (code) => process.exit(code),
): (() => void) => {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;

  const schedule = () => {
    if (stopped) return;
    timer = setTimeout(check, WATCHDOG_INTERVAL_MS);
    // never what keeps a stopping process alive
    timer.unref();
  };

  const check = async () => {
    try {
      const own = await probeRedis(yhub.stream.redis, yhub.stream.prefix);
      // unreachable: node-redis reconnects by itself when the socket drops
      if (own === 'readonly') {
        const fresh = await probeFreshConnection(yhub);
        if (fresh === 'ok') {
          stopped = true;
          await restart(yhub, exit);
          return;
        }
        watchdogLog.warn(
          { fresh },
          'a new connection would not reach a writable primary yet, waiting',
        );
      }
    } catch (err) {
      watchdogLog.error({ err }, 'redis watchdog check failed');
    }
    schedule();
  };

  schedule();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
};
