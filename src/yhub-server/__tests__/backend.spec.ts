// backend.ts — the calls this server makes to the Docs Django backend, and the
// public half of the RS256 key it signs them with.
//
// `@y/hub` is faked for its logger; `global.fetch` is a spy. `./config.ts` runs
// for real — it reads the same stubbed env.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { exportPKCS8, generateKeyPair } from 'jose';

import type { YHub } from '../src/yhub.js';

vi.mock('@y/hub', () => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => logger,
  };
  return {
    logger,
    apiError: (status: number, message: string) =>
      Object.assign(new Error(message), { status }),
  };
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

// The authz cache is off in these specs (its TTLs default to 0), so redis is
// never reached — the handle only carries the key prefix. What is under test is
// the backend call and how its answers map to verdicts; the cached path is
// covered in authz-cache.spec.ts.
describe('the resolve* lookups', () => {
  const noYhub = { stream: { prefix: 'yhub' } } as unknown as YHub;
  const docid = '00000000-0000-4000-8000-000000000000';
  const user = {
    userid: 'u1',
    cookie: 'docs_sessionid=abc',
    origin: 'http://localhost:3000',
  };

  it('resolveUserid answers the backend id as a string', async () => {
    fetchMock.mockResolvedValue(jsonOk({ id: 42 }));
    const { resolveUserid } = await load();

    await expect(resolveUserid(user.cookie, user.origin)).resolves.toBe('42');
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://backend.example.test/api/v1.0/users/me/',
    );
  });

  it('resolveUserid rejects with the backend status, for authenticate to read', async () => {
    fetchMock.mockResolvedValue(httpError(401));
    const { resolveUserid } = await load();

    await expect(resolveUserid(user.cookie, user.origin)).rejects.toMatchObject(
      { status: 401 },
    );
  });

  it('resolveAbilities answers the verdict of an identified caller', async () => {
    fetchMock.mockResolvedValue(
      jsonOk({ abilities: { retrieve: true, update: false } }),
    );
    const { resolveAbilities } = await load();

    await expect(
      resolveAbilities(noYhub, 'docs', docid, user),
    ).resolves.toEqual({
      abilities: { retrieve: true, update: false, versions_list: undefined },
      identified: true,
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://backend.example.test/api/v1.0/documents/${docid}/abilities/`,
    );
  });

  it('resolveAbilities does not identify an anonymous caller', async () => {
    fetchMock.mockResolvedValue(jsonOk({ abilities: { retrieve: true } }));
    const { resolveAbilities } = await load();

    await expect(
      resolveAbilities(noYhub, 'docs', docid, null),
    ).resolves.toMatchObject({ identified: false });
  });

  it.each([401, 403, 404])(
    'resolveAbilities turns a %i refusal into a deny',
    async (status) => {
      fetchMock.mockResolvedValue(httpError(status));
      const { resolveAbilities } = await load();

      await expect(
        resolveAbilities(noYhub, 'docs', docid, user),
      ).resolves.toMatchObject({ abilities: { retrieve: false } });
    },
  );

  it('resolveAbilities answers a retryable 503 when the backend does not answer', async () => {
    fetchMock.mockResolvedValue(httpError(500));
    const { resolveAbilities } = await load();

    await expect(
      resolveAbilities(noYhub, 'docs', docid, user),
    ).rejects.toMatchObject({
      status: 503,
      message: 'Document authorization backend is unavailable',
    });
  });

  it('resolveAccess answers the access payload', async () => {
    fetchMock.mockResolvedValue(jsonOk({ created_at: '2026-01-01T00:00:00Z' }));
    const { resolveAccess } = await load();

    await expect(resolveAccess(noYhub, 'docs', docid, user)).resolves.toEqual({
      created_at: '2026-01-01T00:00:00Z',
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://backend.example.test/api/v1.0/documents/${docid}/accesses/me/`,
    );
  });

  it('resolveAccess turns a refusal into no access', async () => {
    fetchMock.mockResolvedValue(httpError(404));
    const { resolveAccess } = await load();

    await expect(
      resolveAccess(noYhub, 'docs', docid, user),
    ).resolves.toBeNull();
  });

  it('resolveAccess answers a retryable 503 when the backend does not answer', async () => {
    fetchMock.mockResolvedValue(httpError(502));
    const { resolveAccess } = await load();

    await expect(
      resolveAccess(noYhub, 'docs', docid, user),
    ).rejects.toMatchObject({ status: 503 });
  });
});

describe('carriesSessionCookie', () => {
  // imported lazily per test through `load()` like the other describes, so it
  // runs after the file-level beforeEach has stubbed the env: a beforeAll on
  // the describe would import config.ts before the first beforeEach runs, and
  // only pass while every config read keeps a default

  it('accepts a header carrying only the session cookie', async () => {
    const { carriesSessionCookie } = await load();
    expect(carriesSessionCookie('docs_sessionid=abc')).toBe(true);
  });

  it('accepts the session cookie among others', async () => {
    const { carriesSessionCookie } = await load();
    expect(
      carriesSessionCookie('csrftoken=x; docs_sessionid=abc; consent=y'),
    ).toBe(true);
  });

  it('accepts it despite surrounding whitespace around the pair', async () => {
    // browsers separate cookies with "; " and may pad: the name is trimmed,
    // though it stays case-sensitive — RFC 6265 cookie names are
    const { carriesSessionCookie } = await load();
    expect(carriesSessionCookie('csrftoken=x; docs_sessionid = abc')).toBe(
      true,
    );
  });

  it('is case-sensitive on the cookie name, as RFC 6265 makes them', async () => {
    const { carriesSessionCookie } = await load();
    expect(carriesSessionCookie('DOCS_SESSIONID=abc')).toBe(false);
  });

  it('refuses a header with other cookies but no session one', async () => {
    const { carriesSessionCookie } = await load();
    expect(carriesSessionCookie('csrftoken=x; consent=y')).toBe(false);
  });

  it('refuses lookalike names that are not the session cookie', async () => {
    const { carriesSessionCookie } = await load();
    expect(carriesSessionCookie('xdocs_sessionid=abc')).toBe(false);
    expect(carriesSessionCookie('docs_sessionid_extra=abc')).toBe(false);
  });

  it('refuses an empty header', async () => {
    const { carriesSessionCookie } = await load();
    expect(carriesSessionCookie('')).toBe(false);
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
