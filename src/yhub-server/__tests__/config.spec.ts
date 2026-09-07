// config.ts — every environment variable the server reads, parsed and validated
// at import time. Tested directly: no yhub, no stores, no mocks — the env goes
// in, and the exported constants (or the startup throw) come out.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Only what `config.ts` looks at; REDIS/POSTGRES are passed straight through to
// yhub, which is what validates them, so they are not needed here.
const BASE_ENV = {
  COLLABORATION_SERVER_ORIGIN: 'http://localhost:3000',
};

const load = () => import('../src/config.js');

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  for (const [key, value] of Object.entries(BASE_ENV)) vi.stubEnv(key, value);
  // vars a previous test may have set that must not leak in as defaults
  for (const key of [
    'YHUB_ROLE',
    'YHUB_ORG',
    'REDIS_PREFIX',
    'YHUB_TASK_CONCURRENCY',
    'YHUB_TASK_DEBOUNCE_MS',
    'YHUB_MIN_MESSAGE_LIFETIME_MS',
    'PORT',
  ]) {
    vi.stubEnv(key, '');
  }
});

describe('YHUB_ROLE', () => {
  it('defaults to running both halves', async () => {
    const { ROLE, RUNS_SERVER, RUNS_WORKER } = await load();
    expect(ROLE).toBe('all');
    expect(RUNS_SERVER).toBe(true);
    expect(RUNS_WORKER).toBe(true);
  });

  it('a server role runs the server half only', async () => {
    vi.stubEnv('YHUB_ROLE', 'server');
    const { RUNS_SERVER, RUNS_WORKER } = await load();
    expect(RUNS_SERVER).toBe(true);
    expect(RUNS_WORKER).toBe(false);
  });

  it('a worker role runs the worker half only', async () => {
    vi.stubEnv('YHUB_ROLE', 'worker');
    const { RUNS_SERVER, RUNS_WORKER } = await load();
    expect(RUNS_SERVER).toBe(false);
    expect(RUNS_WORKER).toBe(true);
  });

  it('refuses an unknown role', async () => {
    vi.stubEnv('YHUB_ROLE', 'bogus');
    await expect(load()).rejects.toThrow(/YHUB_ROLE must be one of/);
  });
});

describe('the numeric tuning knobs', () => {
  it('refuses a non-integer concurrency', async () => {
    vi.stubEnv('YHUB_TASK_CONCURRENCY', 'abc');
    await expect(load()).rejects.toThrow(
      /YHUB_TASK_CONCURRENCY must be an integer >= 1/,
    );
  });

  it('refuses a concurrency below one', async () => {
    vi.stubEnv('YHUB_TASK_CONCURRENCY', '0');
    await expect(load()).rejects.toThrow(/YHUB_TASK_CONCURRENCY/);
  });

  it('accepts a debounce of zero but not of minus one', async () => {
    vi.stubEnv('YHUB_TASK_DEBOUNCE_MS', '0');
    await expect(load()).resolves.toBeDefined();

    vi.resetModules();
    vi.stubEnv('YHUB_TASK_DEBOUNCE_MS', '-1');
    await expect(load()).rejects.toThrow(/YHUB_TASK_DEBOUNCE_MS/);
  });

  it('treats a blank variable as the default', async () => {
    vi.stubEnv('YHUB_TASK_CONCURRENCY', '');
    const { TASK_CONCURRENCY } = await load();
    expect(TASK_CONCURRENCY).toBe(5);
  });

  it('carries Docs’ stream-timing defaults', async () => {
    const { TASK_DEBOUNCE_MS, MIN_MESSAGE_LIFETIME_MS } = await load();
    expect(TASK_DEBOUNCE_MS).toBe(10000);
    expect(MIN_MESSAGE_LIFETIME_MS).toBe(60000);
  });
});

describe('the origin allowlist', () => {
  it('defaults to localhost:3000', async () => {
    const { allowedOrigins } = await load();
    expect(allowedOrigins).toEqual(['http://localhost:3000']);
  });

  it('splits on commas', async () => {
    vi.stubEnv(
      'COLLABORATION_SERVER_ORIGIN',
      'https://a.example,https://b.example',
    );
    const { allowedOrigins } = await load();
    expect(allowedOrigins).toEqual(['https://a.example', 'https://b.example']);
  });
});

describe('PORT', () => {
  it('defaults to 3002', async () => {
    expect((await load()).PORT).toBe(3002);
  });

  it('is honoured when set', async () => {
    vi.stubEnv('PORT', '4000');
    expect((await load()).PORT).toBe(4000);
  });
});
