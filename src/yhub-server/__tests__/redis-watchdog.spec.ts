// src/redis-watchdog.ts — the restart after a failover. The one rule that
// matters: restart only when this process's connection is read-only AND a
// fresh connection through the same URL can write. Restarting while the
// Service still points at the old node would only land there again.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeLoggerModule } from './_helpers.js';

vi.mock('@y/hub', () => fakeLoggerModule());

const {
  RESTART_DRAIN_MS,
  RESTART_TIMEOUT_MS,
  WATCHDOG_INTERVAL_MS,
  probeFreshConnection,
  startRedisWatchdog,
} = await import('../src/redis-watchdog.js');

const READONLY = "READONLY You can't write against a read only replica.";

type SetBehaviour = 'ok' | 'readonly' | 'down';

const setFor = (behaviour: SetBehaviour) =>
  vi.fn(async () => {
    if (behaviour === 'readonly') throw new Error(READONLY);
    if (behaviour === 'down') throw new Error('connect ECONNREFUSED');
    return 'OK';
  });

const makeFresh = (behaviour: SetBehaviour, connects = true) => {
  const fresh = {
    isOpen: false,
    on: vi.fn(),
    set: setFor(behaviour),
    connect: vi.fn(async () => {
      if (!connects) throw new Error('Connection timeout');
      fresh.isOpen = true;
      return fresh;
    }),
    destroy: vi.fn(() => {
      fresh.isOpen = false;
    }),
  };
  return fresh;
};

// A node that accepts the TCP connection and never answers the handshake, the
// way node-redis sees it: open while it connects, and the pending `connect()`
// rejected by `destroy()`.
const makeStalledFresh = () => {
  let rejectConnect: (err: Error) => void = () => {};
  const fresh = {
    isOpen: false,
    on: vi.fn(),
    set: setFor('ok'),
    connect: vi.fn(
      () =>
        new Promise((_, reject) => {
          fresh.isOpen = true;
          rejectConnect = reject;
        }),
    ),
    destroy: vi.fn(() => {
      fresh.isOpen = false;
      rejectConnect(new Error('Disconnects client'));
    }),
  };
  return fresh;
};

const makeYhub = (
  own: SetBehaviour,
  fresh:
    | ReturnType<typeof makeFresh>
    | ReturnType<typeof makeStalledFresh> = makeFresh('ok'),
) => ({
  stream: {
    prefix: 'yhub',
    redis: {
      set: setFor(own),
      options: { socket: { host: 'valkey', port: 6379 } },
      duplicate: vi.fn(() => fresh),
    },
  },
  destroy: vi.fn(async () => {}),
  fresh,
});

const tick = () => vi.advanceTimersByTimeAsync(WATCHDOG_INTERVAL_MS);

let stop: (() => void) | undefined;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  stop?.();
  stop = undefined;
  vi.useRealTimers();
});

describe('startRedisWatchdog', () => {
  it('leaves a writable connection alone', async () => {
    const yhub = makeYhub('ok');
    const exit = vi.fn();
    stop = startRedisWatchdog(yhub as never, exit);

    await tick();
    await tick();

    expect(yhub.stream.redis.set).toHaveBeenCalledTimes(2);
    expect(yhub.stream.redis.duplicate).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it('leaves an unreachable redis to node-redis own reconnection', async () => {
    const yhub = makeYhub('down');
    const exit = vi.fn();
    stop = startRedisWatchdog(yhub as never, exit);

    await tick();

    expect(yhub.stream.redis.duplicate).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it('restarts once a fresh connection can write', async () => {
    const yhub = makeYhub('readonly', makeFresh('ok'));
    const exit = vi.fn();
    stop = startRedisWatchdog(yhub as never, exit);

    await tick();

    expect(yhub.destroy).toHaveBeenCalledWith({ drainMs: RESTART_DRAIN_MS });
    expect(exit).toHaveBeenCalledWith(1);
    expect(yhub.fresh.destroy).toHaveBeenCalled();
  });

  it('waits while a fresh connection lands on a read-only node too', async () => {
    const yhub = makeYhub('readonly', makeFresh('readonly'));
    const exit = vi.fn();
    stop = startRedisWatchdog(yhub as never, exit);

    await tick();
    await tick();

    expect(yhub.stream.redis.duplicate).toHaveBeenCalledTimes(2);
    expect(yhub.fresh.destroy).toHaveBeenCalledTimes(2);
    expect(yhub.destroy).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it('waits while a fresh connection cannot be opened', async () => {
    const yhub = makeYhub('readonly', makeFresh('ok', false));
    const exit = vi.fn();
    stop = startRedisWatchdog(yhub as never, exit);

    await tick();

    expect(exit).not.toHaveBeenCalled();
    // never opened: destroying it would throw
    expect(yhub.fresh.destroy).not.toHaveBeenCalled();
  });

  it('keeps checking when a fresh connection never completes its handshake', async () => {
    const yhub = makeYhub('readonly', makeStalledFresh());
    const exit = vi.fn();
    stop = startRedisWatchdog(yhub as never, exit);

    await tick();
    await vi.advanceTimersByTimeAsync(2000);
    expect(yhub.fresh.destroy).toHaveBeenCalledTimes(1);

    await tick();
    expect(yhub.stream.redis.duplicate).toHaveBeenCalledTimes(2);
    expect(exit).not.toHaveBeenCalled();
  });

  it('exits even when the shutdown hangs', async () => {
    const yhub = makeYhub('readonly', makeFresh('ok'));
    yhub.destroy.mockImplementation(() => new Promise(() => {}));
    const exit = vi.fn();
    stop = startRedisWatchdog(yhub as never, exit);

    await tick();
    expect(exit).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(RESTART_TIMEOUT_MS);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('stops checking once stopped', async () => {
    const yhub = makeYhub('ok');
    stop = startRedisWatchdog(yhub as never, vi.fn());

    stop();
    await tick();

    expect(yhub.stream.redis.set).not.toHaveBeenCalled();
  });
});

describe('probeFreshConnection', () => {
  it('keeps the socket options of yhub own client, without retries', async () => {
    const yhub = makeYhub('readonly', makeFresh('ok'));

    expect(await probeFreshConnection(yhub as never)).toBe('ok');

    expect(yhub.stream.redis.duplicate).toHaveBeenCalledWith({
      socket: {
        host: 'valkey',
        port: 6379,
        connectTimeout: 2000,
        reconnectStrategy: false,
      },
    });
    // a failed connection must not become an uncaught 'error' event
    expect(yhub.fresh.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('gives up on a handshake that never completes, and closes the client', async () => {
    const yhub = makeYhub('readonly', makeStalledFresh());

    const result = probeFreshConnection(yhub as never);
    await vi.advanceTimersByTimeAsync(2000);

    expect(await result).toBe('unreachable');
    expect(yhub.fresh.destroy).toHaveBeenCalledTimes(1);
    expect(yhub.fresh.isOpen).toBe(false);
  });
});
