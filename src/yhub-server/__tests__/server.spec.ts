// server.ts — the composition root: it builds the persistence plugins and wires
// the auth plugin and the endpoint array into one `await createYHub(...)` call.
// It has no exports, so what a unit test holds onto is that boot contract — the
// S3 configuration it refuses, and the config object it hands yhub.
//
// `@y/hub`, its S3 plugin and `./migration.ts` are faked; the config passed to
// `createYHub` and the args passed to `S3PersistenceV1` are captured. Env
// parsing and validation is `config.ts`'s concern — see config.spec.ts.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// An in-memory stand-in for the redis client the authz cache uses. The real
// entries carry a PX expiration the fake does not model — no test spans the
// TTLs; what the fake must honor is the MGET-after-SET round trip.
const fakeYhubRedis = () => {
  const store = new Map<string, string>();
  return {
    store,
    mGet: async (keys: string[]) => keys.map((key) => store.get(key) ?? null),
    set: async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    },
  };
};

const { createYHub, s3PluginArgs } = vi.hoisted(() => {
  const createYHub = vi.fn(async (config: any) => {
    createYHub.lastConfig = config;
    return {
      stream: {
        taskDebounce: 0,
        minMessageLifetime: 0,
        // the authz cache reads its entries through the stream client: an
        // in-memory map stands in, shared for the life of one boot
        prefix: config.redis.prefix,
        redis: fakeYhubRedis(),
      },
    };
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
    createAuthorize:
      (handlers: Record<string, (...args: unknown[]) => Promise<unknown>>) =>
      async (scope: string, resourceId: unknown, user: unknown) =>
        (await handlers[scope]?.(resourceId, user)) ?? null,
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
    'YHUB_BACKEND_REQUEST_TIMEOUT_MS',
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
    const names = createYHub.lastConfig.server.api.map(
      (e: { name: string }) => e.name,
    );
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

describe('the authenticate cookie gate', () => {
  // backend.ts is NOT mocked here: the spy on `fetch` observes the real
  // `backendFetch`, so these pin what the auth plugin wires together — who
  // is resolved locally, and who costs a backend call. Each test re-boots
  // through boot(), after the file-level beforeEach has stubbed BASE_ENV.
  const request = (
    headers: Record<string, string>,
    url = '/collaboration/ydoc/v1/docs/00000000-0000-4000-8000-000000000000/',
  ) => ({
    getHeader: (name: string) => headers[name] ?? '',
    getUrl: () => url,
  });

  const bootGate = async (): Promise<{
    authenticate: (req: ReturnType<typeof request>) => Promise<unknown>;
    fetchMock: ReturnType<typeof vi.fn>;
  }> => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await boot();
    expect(createYHub.lastConfig.server).not.toBeNull();
    return {
      authenticate: createYHub.lastConfig.server.auth.authenticate,
      fetchMock,
    };
  };

  it('resolves a caller holding other cookies but no session one to anonymous, without calling the backend', async () => {
    const { authenticate, fetchMock } = await bootGate();

    const user = await authenticate(
      request({ cookie: 'csrftoken=x; consent=y' }),
    );

    expect(user).toMatchObject({ userid: 'anonymous' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still asks the backend who a caller carrying the session cookie is', async () => {
    const { authenticate, fetchMock } = await bootGate();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'user-1' }),
    });

    const user = await authenticate(
      request({ cookie: 'csrftoken=x; docs_sessionid=abc' }),
    );

    expect(user).toMatchObject({ userid: 'user-1' });
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://app-dev:8000/api/v1.0/users/me/',
    );
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      cookie: 'csrftoken=x; docs_sessionid=abc',
    });
  });
});

describe('the authorize authz-cache wiring', () => {
  // The refusal mapping (401/403/404 → cached deny) exists only in the
  // `authorize` wiring of server.ts — the unit specs feed `cachedAbilities`
  // happy payloads only. These drive the real plugin against a spied `fetch`.
  const docid = '00000000-0000-4000-8000-000000000000';
  const user = (id: string) => ({
    userid: id,
    cookie: 'csrftoken=x; docs_sessionid=abc',
    origin: 'http://localhost:3000',
    endpoint: 'ydoc',
  });

  const bootAuthorize = async () => {
    // TTLs on: the wiring under test is the cached path, not the disabled one
    vi.stubEnv('YHUB_ABILITIES_CACHE_TTL_MS', '30000');
    vi.stubEnv('YHUB_IDENTITY_CACHE_TTL_MS', '60000');
    vi.stubEnv('Y_PROVIDER_API_KEY', 'the-provider-key');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await boot();
    expect(createYHub.lastConfig.server).not.toBeNull();
    return {
      authorize: createYHub.lastConfig.server.auth.authorize as (
        scope: string,
        resource: { org: string; docid: string; branch: string },
        user: unknown,
      ) => Promise<unknown>,
      fetchMock,
    };
  };

  it('caches a backend refusal as a deny, and the next connection reads it', async () => {
    const { authorize, fetchMock } = await bootAuthorize();
    fetchMock.mockResolvedValue({ ok: false, status: 403 });

    // timedAuth's authorize signature: (scope, resourceId, user)
    await expect(
      authorize('document', { org: 'docs', docid, branch: 'main' }, user('u1')),
    ).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `http://app-dev:8000/api/v1.0/documents/${docid}/`,
    );

    // the second connection costs no backend call: the refusal was cached
    await expect(
      authorize('document', { org: 'docs', docid, branch: 'main' }, user('u1')),
    ).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
