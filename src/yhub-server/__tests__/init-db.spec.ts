// init-db.ts — the retry loop of the helm init-db job. The script it runs is
// stubbed: an attempt is a function resolving to whether it succeeded.

import { existsSync } from 'node:fs';
import { sep } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

vi.mock('@y/hub', () => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    child: () => logger,
  };
  return { logger };
});

const { initDbScript, initDbWithRetries, parseOptions } =
  await import('../src/init-db.js');

// attempts that fail `failures` times, then succeed
const failing = (failures: number) => {
  let calls = 0;
  return vi.fn(async () => ++calls > failures);
};

describe('parseOptions', () => {
  it('defaults to the values of the helm chart', () => {
    expect(parseOptions([])).toEqual({ attempts: 60, delaySeconds: 5 });
  });

  it('reads both options', () => {
    expect(parseOptions(['--attempts=3', '--delay-seconds', '0'])).toEqual({
      attempts: 3,
      delaySeconds: 0,
    });
  });

  it('accepts what the shell loop it replaces did', () => {
    expect(parseOptions(['--attempts=0', '--delay-seconds=0.5'])).toEqual({
      attempts: 0,
      delaySeconds: 0.5,
    });
  });

  it.each([
    [['--attempts=-1'], '--attempts must be an integer >= 0'],
    [['--attempts=1.5'], '--attempts must be an integer >= 0'],
    [['--attempts=ten'], '--attempts must be an integer >= 0'],
    [['--attempts='], '--attempts must be an integer >= 0'],
    [['--delay-seconds=-1'], '--delay-seconds must be a number >= 0'],
    [['--delay-seconds=Infinity'], '--delay-seconds must be a number >= 0'],
    [['--delay-seconds= '], '--delay-seconds must be a number >= 0'],
    [['--delay-seconds=2147484'], '--delay-seconds must be at most 2147483'],
  ])('refuses %j', (args, message) => {
    expect(() => parseOptions(args)).toThrow(message);
  });

  it('refuses an unknown option', () => {
    expect(() => parseOptions(['--retries=3'])).toThrow();
  });
});

describe('initDbWithRetries', () => {
  it('runs the script once when it succeeds', async () => {
    const runOnce = failing(0);
    const wait = vi.fn(async () => {});

    const ok = await initDbWithRetries(
      { attempts: 3, delaySeconds: 5 },
      runOnce,
      wait,
    );

    expect(ok).toBe(true);
    expect(runOnce).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it('succeeds on the single run when no attempt is asked for', async () => {
    const runOnce = failing(0);
    const wait = vi.fn(async () => {});

    const ok = await initDbWithRetries(
      { attempts: 0, delaySeconds: 5 },
      runOnce,
      wait,
    );

    expect(ok).toBe(true);
    expect(runOnce).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it('runs the script once when no attempt is asked for', async () => {
    const runOnce = failing(Infinity);
    const wait = vi.fn(async () => {});

    const ok = await initDbWithRetries(
      { attempts: 0, delaySeconds: 5 },
      runOnce,
      wait,
    );

    expect(ok).toBe(false);
    expect(runOnce).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it('waits between attempts until the script succeeds', async () => {
    const runOnce = failing(2);
    const wait = vi.fn(async () => {});

    const ok = await initDbWithRetries(
      { attempts: 3, delaySeconds: 5 },
      runOnce,
      wait,
    );

    expect(ok).toBe(true);
    expect(runOnce).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls).toEqual([[5000], [5000]]);
  });

  it('waits for a fractional delay', async () => {
    const runOnce = failing(1);
    const wait = vi.fn(async () => {});
    const options = parseOptions(['--attempts=2', '--delay-seconds=0.5']);

    expect(await initDbWithRetries(options, runOnce, wait)).toBe(true);
    expect(wait.mock.calls).toEqual([[500]]);
  });

  it('gives up after the last attempt, without waiting after it', async () => {
    const runOnce = failing(Infinity);
    const wait = vi.fn(async () => {});

    const ok = await initDbWithRetries(
      { attempts: 3, delaySeconds: 5 },
      runOnce,
      wait,
    );

    expect(ok).toBe(false);
    expect(runOnce).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
  });
});

describe('initDbScript', () => {
  it('points at the script of the installed @y/hub', () => {
    const script = initDbScript();

    expect(script.split(sep).join('/')).toMatch(
      /node_modules\/@y\/hub\/bin\/init-db\.js$/,
    );
    expect(existsSync(script)).toBe(true);
  });
});
