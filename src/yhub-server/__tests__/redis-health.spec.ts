// src/redis-health.ts — the write probe. What matters is the classification:
// a node demoted to replica by a failover answers PING but refuses writes with
// READONLY, and that is the one state readiness has to tell apart.

import { hostname } from 'node:os';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeLoggerModule } from './_helpers.js';

vi.mock('@y/hub', () => fakeLoggerModule());

const { HEALTH_KEY_TTL_MS, healthKey, probeRedis } =
  await import('../src/redis-health.js');

// What node-redis rejects with when the server answers an error reply.
const replyError = (message: string): Error => new Error(message);

const writer = (set: (...args: unknown[]) => Promise<unknown>) => ({
  set: vi.fn(set),
});

afterEach(() => {
  vi.useRealTimers();
});

describe('probeRedis', () => {
  it('writes a short-lived key of its own under the prefix', async () => {
    const redis = writer(async () => 'OK');

    expect(await probeRedis(redis as never, 'yhub')).toBe('ok');

    expect(redis.set).toHaveBeenCalledWith(
      `yhub:health:${hostname()}`,
      expect.any(String),
      { expiration: { type: 'PX', value: HEALTH_KEY_TTL_MS } },
    );
    expect(healthKey('other')).toBe(`other:health:${hostname()}`);
  });

  it('reports readonly when the node is a replica', async () => {
    const redis = writer(async () => {
      throw replyError("READONLY You can't write against a read only replica.");
    });

    expect(await probeRedis(redis as never, 'yhub')).toBe('readonly');
  });

  it('reports unreachable on any other error', async () => {
    const redis = writer(async () => {
      throw replyError('connect ECONNREFUSED 10.0.0.1:6379');
    });

    expect(await probeRedis(redis as never, 'yhub')).toBe('unreachable');
  });

  it('reports unreachable when redis does not answer in time', async () => {
    vi.useFakeTimers();
    const redis = writer(() => new Promise(() => {}));

    const result = probeRedis(redis as never, 'yhub', 2000);
    await vi.advanceTimersByTimeAsync(2000);

    expect(await result).toBe('unreachable');
  });
});
