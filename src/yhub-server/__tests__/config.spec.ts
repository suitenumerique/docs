// config.ts — every environment variable the server reads, parsed and validated
// at import time. Tested directly: no yhub, no stores, no mocks — the env goes
// in, and the exported constants (or the startup throw) come out.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Only what these tests require; store configuration is covered by server.spec.ts.
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
    'YHUB_COMPUTE_THREADS',
    'YHUB_COMPUTE_MAX_QUEUE',
    'YHUB_COMPUTE_THREAD_MAX_HEAP_MB',
    'NODE_OPTIONS',
    'YHUB_TASK_DEBOUNCE_MS',
    'YHUB_MIN_MESSAGE_LIFETIME_MS',
    'YHUB_BACKEND_REQUEST_TIMEOUT_MS',
    'YHUB_AUTH_TIMEOUT_MS',
    'YHUB_IDENTITY_CACHE_TTL_MS',
    'YHUB_ABILITIES_CACHE_TTL_MS',
    'YHUB_ACCESS_CACHE_TTL_MS',
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

describe('the compute pool', () => {
  it('leaves every setting to yhub when none is set', async () => {
    const { COMPUTE_THREADS, COMPUTE_MAX_QUEUE, COMPUTE_THREAD_MAX_HEAP_MB } =
      await load();
    expect(COMPUTE_THREADS).toBeUndefined();
    expect(COMPUTE_MAX_QUEUE).toBeUndefined();
    expect(COMPUTE_THREAD_MAX_HEAP_MB).toBeUndefined();
  });

  it('reads the three settings', async () => {
    vi.stubEnv('YHUB_COMPUTE_THREADS', '2');
    vi.stubEnv('YHUB_COMPUTE_MAX_QUEUE', '0');
    vi.stubEnv('YHUB_COMPUTE_THREAD_MAX_HEAP_MB', '512');
    const { COMPUTE_THREADS, COMPUTE_MAX_QUEUE, COMPUTE_THREAD_MAX_HEAP_MB } =
      await load();
    expect(COMPUTE_THREADS).toBe(2);
    expect(COMPUTE_MAX_QUEUE).toBe(0);
    expect(COMPUTE_THREAD_MAX_HEAP_MB).toBe(512);
  });

  it('refuses a pool without threads, and a number that is not one', async () => {
    vi.stubEnv('YHUB_COMPUTE_THREADS', '0');
    await expect(load()).rejects.toThrow(
      /YHUB_COMPUTE_THREADS must be an integer >= 1/,
    );

    vi.resetModules();
    vi.stubEnv('YHUB_COMPUTE_THREADS', '');
    vi.stubEnv('YHUB_COMPUTE_THREAD_MAX_HEAP_MB', '1g');
    await expect(load()).rejects.toThrow(/YHUB_COMPUTE_THREAD_MAX_HEAP_MB/);

    vi.resetModules();
    vi.stubEnv('YHUB_COMPUTE_THREAD_MAX_HEAP_MB', '');
    vi.stubEnv('YHUB_COMPUTE_MAX_QUEUE', '-1');
    await expect(load()).rejects.toThrow(/YHUB_COMPUTE_MAX_QUEUE/);
  });

  it('refuses a thread heap limit that a node heap flag would void', async () => {
    vi.stubEnv('YHUB_COMPUTE_THREAD_MAX_HEAP_MB', '512');
    vi.stubEnv('NODE_OPTIONS', '--max-old-space-size=1024');
    await expect(load()).rejects.toThrow(/has no effect/);

    vi.resetModules();
    vi.stubEnv('NODE_OPTIONS', '--max_heap_size=1024');
    await expect(load()).rejects.toThrow(/has no effect/);

    // node takes the single-dash spelling as well
    vi.resetModules();
    vi.stubEnv('NODE_OPTIONS', '--enable-source-maps -max-old-space-size=2048');
    await expect(load()).rejects.toThrow(/has no effect/);
  });

  it('reads NODE_OPTIONS the way node does, quotes included', async () => {
    vi.stubEnv('YHUB_COMPUTE_THREAD_MAX_HEAP_MB', '512');
    // node drops the quotes and applies the flag
    vi.stubEnv('NODE_OPTIONS', '"--max-old-space-size=2048"');
    await expect(load()).rejects.toThrow(/has no effect/);

    vi.resetModules();
    vi.stubEnv('NODE_OPTIONS', '--enable-source-maps "--max-heap-size=2048"');
    await expect(load()).rejects.toThrow(/has no effect/);
  });

  it('is not fooled by an argument that merely contains the name', async () => {
    vi.stubEnv('YHUB_COMPUTE_THREAD_MAX_HEAP_MB', '512');
    vi.stubEnv('NODE_OPTIONS', '--require=./no-max-old-space-size.js');
    await expect(load()).resolves.toBeDefined();

    // a quoted module path, spaces and all, is one argument
    vi.resetModules();
    vi.stubEnv(
      'NODE_OPTIONS',
      '--require "/opt/hooks/ --max-old-space-size=1.js"',
    );
    await expect(load()).resolves.toBeDefined();

    vi.resetModules();
    vi.stubEnv('NODE_OPTIONS', '--require /opt/max-old-space-size/hook.js');
    await expect(load()).resolves.toBeDefined();
  });

  it('accepts a node heap flag when the threads have no limit of their own', async () => {
    vi.stubEnv('NODE_OPTIONS', '--max-old-space-size=1024');
    await expect(load()).resolves.toBeDefined();
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

  it('bounds the calls to the backend at 5s unless told otherwise', async () => {
    const { BACKEND_REQUEST_TIMEOUT_MS } = await load();
    expect(BACKEND_REQUEST_TIMEOUT_MS).toBe(5000);

    vi.resetModules();
    vi.stubEnv('YHUB_BACKEND_REQUEST_TIMEOUT_MS', '12000');
    expect((await load()).BACKEND_REQUEST_TIMEOUT_MS).toBe(12000);
  });

  it('refuses a backend timeout that is not a positive whole number of ms', async () => {
    // zero would abort every call before it is sent: a backend that is up
    // would read as unavailable on every connection
    vi.stubEnv('YHUB_BACKEND_REQUEST_TIMEOUT_MS', '0');
    await expect(load()).rejects.toThrow(
      /YHUB_BACKEND_REQUEST_TIMEOUT_MS must be an integer >= 1/,
    );

    vi.resetModules();
    vi.stubEnv('YHUB_BACKEND_REQUEST_TIMEOUT_MS', '5s');
    await expect(load()).rejects.toThrow(/YHUB_BACKEND_REQUEST_TIMEOUT_MS/);
  });

  it('gives the auth hooks 30s, above the 10s yhub 0.10 defaults to', async () => {
    // `authorize` chains two backend calls and the 10s S3 fetch of a legacy
    // seed: yhub's own default would cut a slow seed short
    const { AUTH_TIMEOUT_MS } = await load();
    expect(AUTH_TIMEOUT_MS).toBe(30000);

    vi.resetModules();
    vi.stubEnv('YHUB_AUTH_TIMEOUT_MS', '45000');
    expect((await load()).AUTH_TIMEOUT_MS).toBe(45000);
  });

  it('refuses an auth timeout that is not a positive whole number of ms', async () => {
    vi.stubEnv('YHUB_AUTH_TIMEOUT_MS', '0');
    await expect(load()).rejects.toThrow(
      /YHUB_AUTH_TIMEOUT_MS must be an integer >= 1/,
    );

    vi.resetModules();
    vi.stubEnv('YHUB_AUTH_TIMEOUT_MS', '30s');
    await expect(load()).rejects.toThrow(/YHUB_AUTH_TIMEOUT_MS/);
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

describe('the authz cache TTLs', () => {
  it('default to zero: caching off, the behavior yhub has always had', async () => {
    const {
      IDENTITY_CACHE_TTL_MS,
      ABILITIES_CACHE_TTL_MS,
      ACCESS_CACHE_TTL_MS,
    } = await load();
    expect(IDENTITY_CACHE_TTL_MS).toBe(0);
    expect(ABILITIES_CACHE_TTL_MS).toBe(0);
    expect(ACCESS_CACHE_TTL_MS).toBe(0);
  });

  it('are read from the environment', async () => {
    vi.stubEnv('YHUB_IDENTITY_CACHE_TTL_MS', '60000');
    vi.stubEnv('YHUB_ABILITIES_CACHE_TTL_MS', '20000');
    vi.stubEnv('YHUB_ACCESS_CACHE_TTL_MS', '300000');
    const {
      IDENTITY_CACHE_TTL_MS,
      ABILITIES_CACHE_TTL_MS,
      ACCESS_CACHE_TTL_MS,
    } = await load();
    expect(IDENTITY_CACHE_TTL_MS).toBe(60000);
    expect(ABILITIES_CACHE_TTL_MS).toBe(20000);
    expect(ACCESS_CACHE_TTL_MS).toBe(300000);
  });

  it('refuse a negative TTL: a cache that never hits is an error, not a setting', async () => {
    vi.stubEnv('YHUB_ABILITIES_CACHE_TTL_MS', '-1');
    await expect(load()).rejects.toThrow(/YHUB_ABILITIES_CACHE_TTL_MS/);
  });

  it('refuse a non-integer TTL', async () => {
    vi.stubEnv('YHUB_IDENTITY_CACHE_TTL_MS', 'abc');
    await expect(load()).rejects.toThrow(/YHUB_IDENTITY_CACHE_TTL_MS/);
  });
});

describe('PROMETHEUS_METRICS_*', () => {
  beforeEach(() => {
    for (const key of [
      'PROMETHEUS_METRICS_ENABLED',
      'PROMETHEUS_API_KEY',
      'PROMETHEUS_API_KEY_FILE',
      'PROMETHEUS_METRICS_PORT',
      'PROMETHEUS_METRICS_PATH',
    ]) {
      vi.stubEnv(key, '');
    }
  });

  it('is off by default, and then asks for no key', async () => {
    const config = await load();
    expect(config.PROMETHEUS_METRICS_ENABLED).toBe(false);
    expect(config.PROMETHEUS_METRICS_PORT).toBe(9464);
    expect(config.PROMETHEUS_METRICS_PATH).toBe('/metrics');
  });

  it('refuses to start enabled without a key: the metrics would be public', async () => {
    vi.stubEnv('PROMETHEUS_METRICS_ENABLED', 'true');
    await expect(load()).rejects.toThrow(
      'PROMETHEUS_METRICS_ENABLED requires PROMETHEUS_API_KEY to be set',
    );
  });

  it('starts enabled with a key', async () => {
    vi.stubEnv('PROMETHEUS_METRICS_ENABLED', 'true');
    vi.stubEnv('PROMETHEUS_API_KEY', 'a-key');
    vi.stubEnv('PROMETHEUS_METRICS_PORT', '9500');
    vi.stubEnv('PROMETHEUS_METRICS_PATH', '/metrics/yhub');
    const config = await load();
    expect(config.PROMETHEUS_METRICS_ENABLED).toBe(true);
    expect(config.PROMETHEUS_METRICS_PORT).toBe(9500);
    expect(config.PROMETHEUS_METRICS_PATH).toBe('/metrics/yhub');
  });

  it('refuses a path that is not one', async () => {
    vi.stubEnv('PROMETHEUS_METRICS_PATH', 'metrics');
    await expect(load()).rejects.toThrow(
      'PROMETHEUS_METRICS_PATH must start with "/" (got "metrics")',
    );
  });
});
