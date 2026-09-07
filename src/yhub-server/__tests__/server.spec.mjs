// server.js — configuration, the auth plugin, the custom REST endpoints.
//
// The module has no exports and ends on `await createYHub(...)`, so what a unit
// test can hold onto is its boot contract: the environment it refuses, and the
// configuration it hands yhub when it accepts. `@y/hub`, its S3 plugin and
// `./migration.js` are faked; the config object passed to `createYHub` and the
// args passed to `S3PersistenceV1` are captured.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createYHub, s3PluginArgs } = vi.hoisted(() => ({
  createYHub: vi.fn(async (config) => {
    createYHub.lastConfig = config;
    return { stream: { taskDebounce: 0, minMessageLifetime: 0 } };
  }),
  s3PluginArgs: [],
}));

vi.mock('@y/hub', () => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => logger,
  };
  return {
    createYHub,
    logger,
    apiError: (status, message) => Object.assign(new Error(message), { status }),
    checkPermissions: vi.fn(),
    createApiEndpoint: (name, opts) => ({ name, opts }),
    createAuthPlugin: (plugin) => plugin,
    createAuthorize: (handlers) => handlers,
    createDocumentPermissions: (x) => x,
  };
});

vi.mock('@y/hub/plugins/s3', () => ({
  S3PersistenceV1: class {
    constructor(args) {
      this.args = args;
      s3PluginArgs.push(args);
    }
  },
}));

vi.mock('../migration.js', () => ({
  SOFT_MIGRATION: false,
  fullMigrate: vi.fn(),
  isPermanentFailure: vi.fn(() => false),
  maybeMigrate: vi.fn(),
  migrationLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// A clean, minimal environment for every test: only what a test names is
// stubbed on top of this.
const BASE_ENV = {
  REDIS: 'redis://localhost:6379',
  POSTGRES: 'postgres://localhost:5432/yhub',
  COLLABORATION_SERVER_ORIGIN: 'http://localhost:3000',
  SOFT_MIGRATION: 'false',
};

const boot = () => import('../server.js');

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  createYHub.mockClear();
  createYHub.lastConfig = undefined;
  s3PluginArgs.length = 0;
  for (const [key, value] of Object.entries(BASE_ENV)) vi.stubEnv(key, value);
  // vars a previous test may have set that must not leak in as defaults
  for (const key of [
    'YHUB_ROLE',
    'YHUB_TASK_CONCURRENCY',
    'YHUB_TASK_DEBOUNCE_MS',
    'YHUB_MIN_MESSAGE_LIFETIME_MS',
    'YHUB_S3_PERSISTENCE',
    'YHUB_S3_ENDPOINT_URL',
    'YHUB_S3_ACCESS_KEY_ID',
    'YHUB_S3_SECRET_ACCESS_KEY',
    'YHUB_S3_BUCKET_NAME',
    'YHUB_S3_REGION_NAME',
    'PORT',
  ]) {
    vi.stubEnv(key, '');
  }
});

describe('a valid, minimal environment', () => {
  it('starts one yhub with both halves and the collaboration prefix', async () => {
    await boot();

    expect(createYHub).toHaveBeenCalledTimes(1);
    const config = createYHub.lastConfig;
    expect(config.redis.prefix).toBe('yhub');
    expect(config.postgres).toBe('postgres://localhost:5432/yhub');
    expect(config.server.apiPrefix).toBe('collaboration');
    expect(config.server.port).toBe(3002);
    expect(config.server.cors).toEqual({
      origin: ['http://localhost:3000'],
      credentials: true,
    });
    expect(config.worker).not.toBeNull();
    expect(config.persistence).toEqual([]);
  });

  it('passes the stream tuning through with Docs’ defaults', async () => {
    await boot();
    const { redis } = createYHub.lastConfig;
    expect(redis.taskDebounce).toBe(10000);
    expect(redis.minMessageLifetime).toBe(60000);
  });

  it('splits the origin allowlist on commas', async () => {
    vi.stubEnv(
      'COLLABORATION_SERVER_ORIGIN',
      'https://a.example,https://b.example',
    );
    await boot();
    expect(createYHub.lastConfig.server.cors.origin).toEqual([
      'https://a.example',
      'https://b.example',
    ]);
  });

  it('honours PORT', async () => {
    vi.stubEnv('PORT', '4000');
    await boot();
    expect(createYHub.lastConfig.server.port).toBe(4000);
  });
});

describe('YHUB_ROLE', () => {
  it('refuses an unknown role at boot', async () => {
    vi.stubEnv('YHUB_ROLE', 'bogus');
    await expect(boot()).rejects.toThrow(/YHUB_ROLE must be one of/);
  });

  it('a server role binds the port and claims no task', async () => {
    vi.stubEnv('YHUB_ROLE', 'server');
    await boot();
    expect(createYHub.lastConfig.server).not.toBeNull();
    expect(createYHub.lastConfig.worker).toBeNull();
  });

  it('a worker role claims tasks and binds no port', async () => {
    vi.stubEnv('YHUB_ROLE', 'worker');
    await boot();
    expect(createYHub.lastConfig.server).toBeNull();
    expect(createYHub.lastConfig.worker).not.toBeNull();
  });
});

describe('the numeric tuning knobs', () => {
  it('refuses a non-integer concurrency', async () => {
    vi.stubEnv('YHUB_TASK_CONCURRENCY', 'abc');
    await expect(boot()).rejects.toThrow(
      /YHUB_TASK_CONCURRENCY must be an integer >= 1/,
    );
  });

  it('refuses a concurrency below one', async () => {
    vi.stubEnv('YHUB_TASK_CONCURRENCY', '0');
    await expect(boot()).rejects.toThrow(/YHUB_TASK_CONCURRENCY/);
  });

  it('accepts a debounce of zero but not of minus one', async () => {
    vi.stubEnv('YHUB_TASK_DEBOUNCE_MS', '0');
    await expect(boot()).resolves.toBeDefined();

    vi.resetModules();
    vi.stubEnv('YHUB_TASK_DEBOUNCE_MS', '-1');
    await expect(boot()).rejects.toThrow(/YHUB_TASK_DEBOUNCE_MS/);
  });

  it('treats a blank variable as the default', async () => {
    vi.stubEnv('YHUB_TASK_CONCURRENCY', '');
    await boot();
    expect(createYHub.lastConfig.worker.taskConcurrency).toBe(5);
  });
});

describe('the S3 persistence plugin', () => {
  const S3_ENV = {
    YHUB_S3_ENDPOINT_URL: 'https://s3.example.test',
    YHUB_S3_ACCESS_KEY_ID: 'key',
    YHUB_S3_SECRET_ACCESS_KEY: 'secret',
    YHUB_S3_BUCKET_NAME: 'yhub-blobs',
  };
  const stubS3Env = () => {
    for (const [k, v] of Object.entries(S3_ENV)) vi.stubEnv(k, v);
  };

  it('loads no plugin when no bucket is configured', async () => {
    await boot();
    expect(s3PluginArgs).toHaveLength(0);
  });

  it('refuses a half-configured bucket, naming what is missing', async () => {
    vi.stubEnv('YHUB_S3_ENDPOINT_URL', 'https://s3.example.test');
    await expect(boot()).rejects.toThrow(
      /partly configured, missing YHUB_S3_ACCESS_KEY_ID/,
    );
  });

  it('refuses YHUB_S3_PERSISTENCE=true without the bucket settings', async () => {
    vi.stubEnv('YHUB_S3_PERSISTENCE', 'true');
    await expect(boot()).rejects.toThrow(/YHUB_S3_PERSISTENCE=true requires/);
  });

  it('attaches the plugin read-only when the toggle is off', async () => {
    stubS3Env();
    await boot();
    expect(s3PluginArgs).toHaveLength(1);
    expect(s3PluginArgs[0]).toMatchObject({
      bucket: 'yhub-blobs',
      branches: [],
      deleteVersions: true,
    });
  });

  it('offloads every branch when the toggle is on', async () => {
    stubS3Env();
    vi.stubEnv('YHUB_S3_PERSISTENCE', 'true');
    await boot();
    expect(s3PluginArgs[0].branches).toBe(true);
  });

  it('refuses an endpoint URL that carries a path', async () => {
    stubS3Env();
    vi.stubEnv('YHUB_S3_ENDPOINT_URL', 'https://s3.example.test/bucket');
    await expect(boot()).rejects.toThrow(/must not contain a path/);
  });

  it('refuses a non-http(s) endpoint scheme', async () => {
    stubS3Env();
    vi.stubEnv('YHUB_S3_ENDPOINT_URL', 'ftp://s3.example.test');
    await expect(boot()).rejects.toThrow(/must be http:\/\/ or https:\/\//);
  });
});
