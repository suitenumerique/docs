// backend.ts — the calls this server makes to the Docs Django backend, and the
// public half of the RS256 key it signs them with.
//
// `@y/hub` is faked for its logger; `global.fetch` is a spy. `./config.ts` runs
// for real — it reads the same stubbed env.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { exportPKCS8, generateKeyPair } from 'jose';

vi.mock('@y/hub', () => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => logger,
  };
  return { logger };
});

const BASE_ENV = {
  COLLABORATION_BACKEND_BASE_URL: 'https://backend.example.test',
  Y_PROVIDER_API_KEY: 'the-provider-key',
};

const load = () => import('../src/backend.js');

// A PKCS8 PEM for a fresh RS256 key, for the tests that need a configured signer.
const freshPrivateKeyPem = async (): Promise<string> => {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  return exportPKCS8(privateKey);
};

const jsonOk = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
});
const httpError = (status: number) => ({ ok: false, status });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  for (const [key, value] of Object.entries(BASE_ENV)) vi.stubEnv(key, value);
  vi.stubEnv('YHUB_JWT_PRIVATE_KEY', '');
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('backendFetch', () => {
  it('sends the provider key and forwards the caller’s cookie and origin', async () => {
    fetchMock.mockResolvedValue(jsonOk({ id: 'u1' }));
    const { backendFetch } = await load();

    const body = await backendFetch('/api/v1.0/users/me/', {
      cookie: 'sessionid=abc',
      origin: 'https://app.example',
    });

    expect(body).toEqual({ id: 'u1' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://backend.example.test/api/v1.0/users/me/');
    expect(init.headers).toMatchObject({
      cookie: 'sessionid=abc',
      origin: 'https://app.example',
      'X-Y-Provider-Key': 'the-provider-key',
    });
  });

  it('omits cookie and origin entirely when the caller has neither', async () => {
    fetchMock.mockResolvedValue(jsonOk({}));
    const { backendFetch } = await load();

    await backendFetch('/api/v1.0/documents/x/', {});

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).not.toHaveProperty('cookie');
    expect(init.headers).not.toHaveProperty('origin');
    expect(init.headers['X-Y-Provider-Key']).toBe('the-provider-key');
  });

  it('rejects with the HTTP status tagged on the error', async () => {
    fetchMock.mockResolvedValue(httpError(403));
    const { backendFetch } = await load();

    await expect(
      backendFetch('/api/v1.0/documents/x/', {}),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('gives up within the timeout on a backend that never answers', async () => {
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      // the real fetch rejects when the signal aborts; a missing signal must
      // fail the test right here rather than let it hang
      expect(init.signal).toBeInstanceOf(AbortSignal);
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(new DOMException('The operation timed out.', 'TimeoutError')),
        );
      });
    });
    const { backendFetch } = await load();

    const startedAt = Date.now();
    // a short timeout is injected rather than faking timers, so the call is
    // exercised against the real clock
    const rejection = backendFetch('/api/v1.0/users/me/', { timeoutMs: 50 });
    await expect(rejection).rejects.toThrowError(/timed out/i);
    expect(Date.now() - startedAt).toBeLessThan(2000);
  });

  it('gives up within the timeout when the body stalls after the headers arrived', async () => {
    // headers came in time — a bookkeeping that stops at the fetch phase would
    // read this as a clean 200. The body read shares the signal: the timeout
    // must still surface, without a status
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      expect(init.signal).toBeInstanceOf(AbortSignal);
      return Promise.resolve(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('{"partial":'));
              init.signal?.addEventListener('abort', () =>
                controller.error(
                  new DOMException('The operation timed out.', 'TimeoutError'),
                ),
              );
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    });
    const { backendFetch } = await load();

    const startedAt = Date.now();
    const err = await backendFetch('/api/v1.0/users/me/', {
      timeoutMs: 50,
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).name).toBe('TimeoutError');
    expect((err as { status?: number }).status).toBeUndefined();
    expect(Date.now() - startedAt).toBeLessThan(2000);
  });

  it('times out without a status, so the auth layer reads it as unavailability', async () => {
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      expect(init.signal).toBeInstanceOf(AbortSignal);
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(new DOMException('The operation timed out.', 'TimeoutError')),
        );
      });
    });
    const { backendFetch } = await load();

    // server.ts maps an error carrying no `status` to a retryable 503 — had
    // the timeout answered 401/403 instead, a slow backend would read as a
    // permission denial
    const err = await backendFetch('/api/v1.0/documents/x/', {
      timeoutMs: 50,
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as { status?: number }).status).toBeUndefined();
  });
});

describe('the backend signing key', () => {
  it('publishes no JWK when YHUB_JWT_PRIVATE_KEY is unset', async () => {
    const { backendPublicJwk } = await load();
    expect(backendPublicJwk).toBeNull();
  });

  it('publishes only the public half, with a stable kid, when a key is set', async () => {
    vi.stubEnv('YHUB_JWT_PRIVATE_KEY', await freshPrivateKeyPem());
    const { backendPublicJwk } = await load();

    expect(backendPublicJwk).toMatchObject({
      kty: 'RSA',
      alg: 'RS256',
      use: 'sig',
    });
    expect(backendPublicJwk).toHaveProperty('kid');
    // no private components leak into the published key
    expect(backendPublicJwk).not.toHaveProperty('d');
    expect(backendPublicJwk).not.toHaveProperty('p');
    expect(backendPublicJwk).not.toHaveProperty('q');
  });
});

describe('touchDocument', () => {
  it('does nothing, and never calls the backend, without a signing key', async () => {
    const { touchDocument } = await load();
    await touchDocument('doc-1');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs a bearer-token notification when a key is configured', async () => {
    vi.stubEnv('YHUB_JWT_PRIVATE_KEY', await freshPrivateKeyPem());
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    const { touchDocument } = await load();

    await touchDocument('doc-1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://backend.example.test/api/v1.0/documents/doc-1/content-updated/',
    );
    expect(init.method).toBe('POST');
    expect(init.headers.authorization).toMatch(/^Bearer /);
  });

  it('swallows a backend failure rather than throwing into the worker', async () => {
    vi.stubEnv('YHUB_JWT_PRIVATE_KEY', await freshPrivateKeyPem());
    fetchMock.mockRejectedValue(new Error('network down'));
    const { touchDocument } = await load();

    await expect(touchDocument('doc-1')).resolves.toBeUndefined();
  });
});
