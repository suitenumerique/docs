/**
 * Can this process write to its redis? A `PING` cannot tell: a node demoted to
 * replica by a Sentinel failover answers it, and keeps the connections it had,
 * while it refuses every write with `READONLY`. yhub's clients only reconnect
 * when their socket drops, so they can sit on such a node indefinitely.
 * The probe therefore writes, the one thing that fails there.
 */
import { hostname } from 'node:os';

import { logger } from '@y/hub';

import { READINESS_TIMEOUT_MS } from './config.js';
import type { YHub } from './yhub.js';

export type RedisHealth = 'ok' | 'readonly' | 'unreachable';

// Any client that can `SET`: yhub's own, or a fresh one opened to compare.
export type RedisWriter = Pick<YHub['stream']['redis'], 'set'>;

// Long enough to outlive a probe interval, short enough that a stopped pod
// leaves nothing behind for long.
export const HEALTH_KEY_TTL_MS = 30_000;

const healthLog = logger.child({ module: 'redis-health' });

// One key per process: replicas never write over each other's probe.
export const healthKey = (prefix: string): string =>
  `${prefix}:health:${hostname()}`;

/**
 * Write a short-lived key and say how it went. Never throws, and never returns
 * the error itself: a redis client may put its URL in the message, and the
 * readiness route that reports this is public.
 */
export const probeRedis = async (
  redis: RedisWriter,
  prefix: string,
  timeoutMs: number = READINESS_TIMEOUT_MS,
): Promise<RedisHealth> => {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      redis.set(healthKey(prefix), String(Date.now()), {
        expiration: { type: 'PX', value: HEALTH_KEY_TTL_MS },
      }),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`no answer in ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
    return 'ok';
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.startsWith('READONLY')) {
      healthLog.warn('redis only accepts reads: connected to a replica');
      return 'readonly';
    }
    healthLog.warn({ err: message }, 'redis is unreachable');
    return 'unreachable';
  } finally {
    clearTimeout(timer);
  }
};
