// sentry.ts — the module preloaded with `node --import`. Tested with both SDK
// packages mocked: the environment goes in, and what is handed to `Sentry.init`
// (or the fact that the SDK was never touched) comes out.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const sentry = vi.hoisted(() => ({
  loaded: vi.fn(),
  init: vi.fn(),
  setTag: vi.fn(),
  pinoIntegration: vi.fn((options: unknown) => ({ name: 'Pino', options })),
  onUnhandledRejectionIntegration: vi.fn((options: unknown) => ({
    name: 'OnUnhandledRejection',
    options,
  })),
}));
const profiling = vi.hoisted(() => ({
  loaded: vi.fn(),
  nodeProfilingIntegration: vi.fn(() => ({ name: 'ProfilingIntegration' })),
}));

vi.mock('@sentry/node', () => {
  sentry.loaded();
  return sentry;
});
vi.mock('@sentry/profiling-node', () => {
  profiling.loaded();
  return profiling;
});

const load = () => import('../src/sentry.js');

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
  for (const key of [
    'SENTRY_DSN',
    'SENTRY_DSN_FILE',
    'SENTRY_ENVIRONMENT',
    'SENTRY_RELEASE',
    'SENTRY_TRACES_SAMPLE_RATE',
    'SENTRY_PROFILES_SAMPLE_RATE',
    'YHUB_ROLE',
  ]) {
    vi.stubEnv(key, '');
  }
});

describe('without a SENTRY_DSN', () => {
  it('does not even import the SDK', async () => {
    await load();

    expect(sentry.loaded).not.toHaveBeenCalled();
    expect(profiling.loaded).not.toHaveBeenCalled();
    expect(sentry.init).not.toHaveBeenCalled();
  });

  it('ignores the other settings', async () => {
    vi.stubEnv('SENTRY_TRACES_SAMPLE_RATE', '1');
    vi.stubEnv('SENTRY_PROFILES_SAMPLE_RATE', '1');

    await load();

    expect(sentry.loaded).not.toHaveBeenCalled();
    expect(profiling.loaded).not.toHaveBeenCalled();
  });
});

describe('with a SENTRY_DSN', () => {
  beforeEach(() => {
    vi.stubEnv('SENTRY_DSN', 'https://key@sentry.example.com/1');
  });

  it('reports errors only, by default', async () => {
    await load();

    expect(sentry.init).toHaveBeenCalledTimes(1);
    expect(sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://key@sentry.example.com/1',
        environment: undefined,
        release: undefined,
        tracesSampleRate: 0,
        profilesSampleRate: 0,
      }),
    );
    // the native profiler is not loaded by a deployment that does not profile
    expect(profiling.loaded).not.toHaveBeenCalled();
  });

  it('reports the error lines of the logger and keeps node crashing on unhandled rejections', async () => {
    await load();

    expect(sentry.pinoIntegration).toHaveBeenCalledWith({
      error: { levels: ['error', 'fatal'] },
    });
    expect(sentry.onUnhandledRejectionIntegration).toHaveBeenCalledWith({
      mode: 'strict',
    });
    const { integrations } = sentry.init.mock.calls[0][0] as {
      integrations: Array<{ name: string }>;
    };
    expect(integrations.map(({ name }) => name)).toEqual([
      'Pino',
      'OnUnhandledRejection',
    ]);
  });

  it('takes the environment, the release and the sampling rates from the environment', async () => {
    vi.stubEnv('SENTRY_ENVIRONMENT', 'preprod');
    vi.stubEnv('SENTRY_RELEASE', 'docs@5.0.0');
    vi.stubEnv('SENTRY_TRACES_SAMPLE_RATE', '0.25');
    vi.stubEnv('SENTRY_PROFILES_SAMPLE_RATE', '0.5');

    await load();

    expect(sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        environment: 'preprod',
        release: 'docs@5.0.0',
        tracesSampleRate: 0.25,
        profilesSampleRate: 0.5,
      }),
    );
  });

  it('loads the profiler only when profiles are sampled', async () => {
    vi.stubEnv('SENTRY_PROFILES_SAMPLE_RATE', '0.5');

    await load();

    expect(profiling.nodeProfilingIntegration).toHaveBeenCalledTimes(1);
    const { integrations } = sentry.init.mock.calls[0][0] as {
      integrations: Array<{ name: string }>;
    };
    expect(integrations.map(({ name }) => name)).toContain(
      'ProfilingIntegration',
    );
  });

  it('tags the events with the application and the role of the process', async () => {
    vi.stubEnv('YHUB_ROLE', 'worker');

    await load();

    expect(sentry.setTag).toHaveBeenCalledWith('application', 'yhub-server');
    expect(sentry.setTag).toHaveBeenCalledWith('role', 'worker');
  });

  it.each([
    ['SENTRY_TRACES_SAMPLE_RATE', 'abc'],
    ['SENTRY_TRACES_SAMPLE_RATE', '1.5'],
    ['SENTRY_PROFILES_SAMPLE_RATE', '-0.1'],
  ])('refuses to start when %s is "%s"', async (name, value) => {
    vi.stubEnv(name, value);

    await expect(load()).rejects.toThrow(
      `${name} must be a number between 0 and 1 (got "${value}")`,
    );
    expect(sentry.init).not.toHaveBeenCalled();
  });
});
