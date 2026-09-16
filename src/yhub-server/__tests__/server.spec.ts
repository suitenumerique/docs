// server.ts — the composition root: it builds the persistence plugins and wires
// the auth plugin and the endpoint array into one `await createYHub(...)` call.
// It has no exports, so what a unit test holds onto is that boot contract — the
// S3 configuration it refuses, and the config object it hands yhub.
//
// `@y/hub`, its S3 plugin and `./migration.ts` are faked; the config passed to
// `createYHub` and the args passed to `S3PersistenceV1` are captured. Env
// parsing and validation is `config.ts`'s concern — see config.spec.ts.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createYHub, s3PluginArgs } = vi.hoisted(() => {
  const createYHub = vi.fn(async (config: any) => {
    createYHub.lastConfig = config;
    return { stream: { taskDebounce: 0, minMessageLifetime: 0 } };
  }) as ReturnType<typeof vi.fn> & { lastConfig?: any };
  return { createYHub, s3PluginArgs: [] as any[] };
});

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
    apiError: (status: number, message: string) =>
      Object.assign(new Error(message), { status }),
    checkPermissions: vi.fn(),
    createApiEndpoint: (name: string, opts: unknown) => ({ name, opts }),
    createAuthPlugin: (plugin: unknown) => plugin,
    createAuthorize: (handlers: unknown) => handlers,
    createDocumentPermissions: (x: unknown) => x,
  };
});

vi.mock('@y/hub/plugins/s3', () => ({
  S3PersistenceV1: class {
    args: unknown;
    constructor(args: unknown) {
      this.args = args;
      s3PluginArgs.push(args);
    }
  },
}));

vi.mock('../src/migration.js', () => ({
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

const boot = () => import('../src/server.js');

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

  it('threads config.ts’ stream tuning and concurrency into the yhub config', async () => {
    await boot();
    const { redis, worker } = createYHub.lastConfig;
    expect(redis.taskDebounce).toBe(10000);
    expect(redis.minMessageLifetime).toBe(60000);
    expect(worker.taskConcurrency).toBe(5);
  });
});

describe('the process role', () => {
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

  it('the endpoint array is handed to the server half', async () => {
    await boot();
    // createApiEndpoint is faked to `{ name, opts }` — assert the routes are wired
    const names = createYHub.lastConfig.server.api.map((e: { name: string }) => e.name);
    expect(names).toEqual(
      expect.arrayContaining(['ping', 'ready', 'jwks', 'create-ydoc']),
    );
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
