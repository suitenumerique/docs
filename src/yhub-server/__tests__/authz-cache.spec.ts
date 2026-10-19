// authz-cache.ts — the split-TTL cache between yhub and the Docs backend.
//
// `@y/hub` is faked for its logger; the yhub handle is a stub carrying a
// faked redis (an in-memory map standing in for MGET/SET), so the specs
// observe what the cache stores, serves and retires. `./config.ts` runs
// for real: the TTLs a test needs are stubbed before the import.

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

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

const BASE_ENV = {
  YHUB_IDENTITY_CACHE_TTL_MS: '60000',
  YHUB_ABILITIES_CACHE_TTL_MS: '30000',
  YHUB_ACCESS_CACHE_TTL_MS: '300000',
};

// An in-memory stand-in for the redis commands the cache uses (MGET and SET),
// and `sets` records every SET's options so a test can assert the TTL a write
// carried.
const fakeRedis = () => {
  const store = new Map<string, string>();
  return {
    store,
    sets: [] as {
      key: string;
      options?: { expiration?: { type: string; value: number } };
    }[],
    async mGet(keys: string[]) {
      return keys.map((key) => store.get(key) ?? null);
    },
    async set(
      key: string,
      value: string,
      options?: { expiration?: { type: string; value: number } },
    ) {
      this.sets.push({ key, options });
      store.set(key, value);
    },
  };
};

// What an entry holds: its value next to the generation it was read under.
const stored = (raw: string) =>
  JSON.parse(raw) as { gen: string; value: unknown };

import type { BackendDocument } from '../src/backend.js';
import type { YHub } from '../src/yhub.js';

type FakeYHub = {
  stream: { prefix: string; redis: ReturnType<typeof fakeRedis> };
};

const asYHub = (fake: FakeYHub): YHub => fake as unknown as YHub;

const load = () => import('../src/authz-cache.js');

const COOKIE = 'csrftoken=x; docs_sessionid=abc';

const DOC_ABILITIES: BackendDocument = {
  abilities: { retrieve: true, update: true, versions_list: true },
};

let yhub: FakeYHub;
// The cache asks each fetch for a specific payload shape; the tests hand the
// mock whatever the scenario needs and the callback boundary casts it there.
let fetchMock: Mock<() => Promise<unknown>>;

const fetching =
  <T>(): (() => Promise<T>) =>
  () =>
    fetchMock() as Promise<T>;

beforeEach(async () => {
  vi.unstubAllEnvs();
  vi.resetModules();
  for (const [key, value] of Object.entries(BASE_ENV)) vi.stubEnv(key, value);
  yhub = { stream: { prefix: 'yhub', redis: fakeRedis() } };
  fetchMock = vi.fn() as Mock<() => Promise<unknown>>;
});

describe('the identity cache', () => {
  it('round-trips a cookie to the userid the backend resolved', async () => {
    const { identityCache } = await load();
    identityCache.set(COOKIE, 'user-1');
    expect(identityCache.get(COOKIE)).toBe('user-1');
  });

  it('keys on a hash of the cookie, never the cookie itself', async () => {
    const { identityCache, hashCookie } = await load();
    identityCache.set(COOKIE, 'user-1');
    // the key the entry lives under is the digest, not the session id
    expect(hashCookie(COOKIE)).not.toContain('abc');
    expect(hashCookie(COOKIE)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('forgets an entry once its TTL has passed', async () => {
    vi.stubEnv('YHUB_IDENTITY_CACHE_TTL_MS', '10');
    const { identityCache } = await load();
    identityCache.set(COOKIE, 'user-1');
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(identityCache.get(COOKIE)).toBeUndefined();
  });

  it('evicts only the least recently used session when full, not every one', async () => {
    const { identityCache } = await load();
    identityCache.set('docs_sessionid=oldest', 'user-0');
    identityCache.set('docs_sessionid=hot', 'user-1');
    for (let i = 0; i < 99_998; i += 1) {
      identityCache.set(`docs_sessionid=${i}`, `user-${i}`);
    }
    // the cache is full; reading `hot` makes `oldest` the least recently used
    expect(identityCache.get('docs_sessionid=hot')).toBe('user-1');

    identityCache.set('docs_sessionid=new', 'user-new');

    expect(identityCache.get('docs_sessionid=oldest')).toBeUndefined();
    expect(identityCache.get('docs_sessionid=hot')).toBe('user-1');
    expect(identityCache.get('docs_sessionid=new')).toBe('user-new');
  });

  it('is disabled by a zero TTL: nothing is stored, nothing is served', async () => {
    vi.stubEnv('YHUB_IDENTITY_CACHE_TTL_MS', '0');
    const { identityCache } = await load();
    identityCache.set(COOKIE, 'user-1');
    expect(identityCache.get(COOKIE)).toBeUndefined();
  });
});

describe('cachedAbilities', () => {
  it('fetches on a miss, and caches the abilities under the hashed cookie', async () => {
    fetchMock.mockResolvedValue(DOC_ABILITIES);
    const { cachedAbilities } = await load();

    const { abilities, identified } = await cachedAbilities(
      asYHub(yhub),
      'docs',
      'd1',
      COOKIE,
      'user-1',
      fetching(),
    );

    expect(identified).toBe(true);
    expect(abilities).toEqual(DOC_ABILITIES.abilities);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // the stored value is the abilities alone, keyed by the cookie's digest,
    // under the initial generation of a document never invalidated
    const [[key, raw]] = [...yhub.stream.redis.store.entries()].filter(([k]) =>
      k.includes(':authz:abilities:{docs:d1}:'),
    );
    expect(key).not.toContain('abc');
    expect(stored(raw)).toEqual({ gen: '0', value: DOC_ABILITIES.abilities });
  });

  it('serves a second caller with the same cookie without a backend call', async () => {
    fetchMock.mockResolvedValue(DOC_ABILITIES);
    const { cachedAbilities } = await load();
    const args = [asYHub(yhub), 'docs', 'd1', COOKIE, 'user-1'] as const;

    await cachedAbilities(...args, fetching());
    const second = await cachedAbilities(...args, fetching());

    expect(second.abilities).toEqual(DOC_ABILITIES.abilities);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shares one verdict per document between anonymous callers', async () => {
    fetchMock.mockResolvedValue({ abilities: { retrieve: true } });
    const { cachedAbilities } = await load();
    const args = [asYHub(yhub), 'docs', 'd1'] as const;

    const first = await cachedAbilities(
      ...args,
      undefined,
      'anonymous',
      fetching(),
    );
    // a different cookie that also resolved anonymous (the 401 fallback)
    const second = await cachedAbilities(
      ...args,
      'docs_sessionid=dead',
      'anonymous',
      fetching(),
    );

    expect(first.identified).toBe(false);
    expect(second.identified).toBe(false);
    expect(first.abilities).toEqual(second.abilities);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect([...yhub.stream.redis.store.keys()]).toEqual([
      'yhub:authz:abilities:{docs:d1}:anon',
    ]);
  });

  it('does not share an anonymous verdict with an identified caller', async () => {
    fetchMock.mockResolvedValue(DOC_ABILITIES);
    const { cachedAbilities } = await load();
    const args = [asYHub(yhub), 'docs', 'd1'] as const;

    await cachedAbilities(...args, undefined, 'anonymous', fetching());
    await cachedAbilities(...args, COOKIE, 'user-1', fetching());

    // two distinct keys: the editor's abilities must not be handed to a
    // visitor who reaches the document by link alone
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect([...yhub.stream.redis.store.keys()].sort()).toEqual([
      'yhub:authz:abilities:{docs:d1}:anon',
      expect.stringMatching(/:authz:abilities:\{docs:d1\}:[0-9a-f]{64}$/),
    ]);
  });

  it('rethrows a backend error: an error is never cached as a verdict', async () => {
    fetchMock.mockRejectedValue(new Error('backend down'));
    const { cachedAbilities } = await load();

    await expect(
      cachedAbilities(asYHub(yhub), 'docs', 'd1', COOKIE, 'user-1', fetching()),
    ).rejects.toThrow('backend down');
    expect([...yhub.stream.redis.store.keys()]).toEqual([]);
    // and the next caller fetches again rather than reading a stored failure
    fetchMock.mockResolvedValue(DOC_ABILITIES);
    await expect(
      cachedAbilities(asYHub(yhub), 'docs', 'd1', COOKIE, 'user-1', fetching()),
    ).resolves.toBeDefined();
  });

  it('reads through to the backend when redis does not answer', async () => {
    fetchMock.mockResolvedValue(DOC_ABILITIES);
    const { cachedAbilities } = await load();
    yhub.stream.redis.mGet = vi.fn().mockRejectedValue(new Error('redis down'));

    await expect(
      cachedAbilities(asYHub(yhub), 'docs', 'd1', COOKIE, 'user-1', fetching()),
    ).resolves.toMatchObject({ abilities: DOC_ABILITIES.abilities });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // no generation could be read, so nothing could be safely stored either
    expect(yhub.stream.redis.store.size).toBe(0);
  });

  it('stores nothing at all with a zero TTL', async () => {
    vi.stubEnv('YHUB_ABILITIES_CACHE_TTL_MS', '0');
    fetchMock.mockResolvedValue(DOC_ABILITIES);
    const { cachedAbilities } = await load();

    await cachedAbilities(
      asYHub(yhub),
      'docs',
      'd1',
      COOKIE,
      'user-1',
      fetching(),
    );
    await cachedAbilities(
      asYHub(yhub),
      'docs',
      'd1',
      COOKIE,
      'user-1',
      fetching(),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect([...yhub.stream.redis.store.keys()]).toEqual([]);
  });

  it('writes every entry with a PX expiration: a lost invalidation must expire', async () => {
    fetchMock.mockResolvedValue(DOC_ABILITIES);
    const { cachedAbilities, cachedAccess } = await load();

    await cachedAbilities(
      asYHub(yhub),
      'docs',
      'd1',
      COOKIE,
      'user-1',
      fetching(),
    );
    await cachedAccess(asYHub(yhub), 'docs', 'd1', 'user-1', fetching());

    // an entry without a TTL would live forever in real redis and turn a
    // lost kick into a permanent grant — the expiration IS the backstop
    const abilitiesSet = yhub.stream.redis.sets.find(
      ({ key }: { key: string }) => key.includes(':authz:abilities:'),
    );
    const accessSet = yhub.stream.redis.sets.find(({ key }: { key: string }) =>
      key.includes(':authz:access:'),
    );
    expect(abilitiesSet?.options?.expiration).toEqual({
      type: 'PX',
      value: 30000,
    });
    expect(accessSet?.options?.expiration).toEqual({
      type: 'PX',
      value: 300000,
    });
  });

  it('survives a redis that refuses writes: the fresh verdict is still served', async () => {
    fetchMock.mockResolvedValue(DOC_ABILITIES);
    const { cachedAbilities } = await load();
    yhub.stream.redis.set = async () => {
      throw new Error('redis write failed');
    };

    await expect(
      cachedAbilities(asYHub(yhub), 'docs', 'd1', COOKIE, 'user-1', fetching()),
    ).resolves.toMatchObject({ abilities: DOC_ABILITIES.abilities });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('cachedAccess', () => {
  it('fetches the access payload on a miss and caches it raw', async () => {
    fetchMock.mockResolvedValue({ created_at: '2026-01-01T00:00:00Z' });
    const { cachedAccess } = await load();

    const first = await cachedAccess(
      asYHub(yhub),
      'docs',
      'd1',
      'user-1',
      fetching(),
    );
    const second = await cachedAccess(
      asYHub(yhub),
      'docs',
      'd1',
      'user-1',
      fetching(),
    );

    expect(first).toEqual({ created_at: '2026-01-01T00:00:00Z' });
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('caches a null answer, so a revoked reader costs one call per TTL', async () => {
    fetchMock.mockResolvedValue(null);
    const { cachedAccess } = await load();

    await cachedAccess(asYHub(yhub), 'docs', 'd1', 'user-1', fetching());
    await cachedAccess(asYHub(yhub), 'docs', 'd1', 'user-1', fetching());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [raw] = [...yhub.stream.redis.store.values()];
    expect(stored(raw).value).toBeNull();
  });

  it('keys per user: two users of one document do not share an access', async () => {
    fetchMock.mockResolvedValue({ created_at: '2026-01-01T00:00:00Z' });
    const { cachedAccess } = await load();

    await cachedAccess(asYHub(yhub), 'docs', 'd1', 'user-1', fetching());
    await cachedAccess(asYHub(yhub), 'docs', 'd1', 'user-2', fetching());

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      [...yhub.stream.redis.store.keys()].filter((k) => k.includes(':access:')),
    ).toHaveLength(2);
  });
});

describe('invalidateDocumentAuthz', () => {
  it('retires every abilities and access entry of one document, and nothing else', async () => {
    const { cachedAbilities, cachedAccess, invalidateDocumentAuthz } =
      await load();
    fetchMock.mockResolvedValue(DOC_ABILITIES);
    // one redis, two prefixes: what a deployment with multiple yhubs over a
    // single store looks like — the invalidation must scope by prefix as well
    // as by document
    const otherPrefix: FakeYHub = {
      stream: { prefix: 'other', redis: yhub.stream.redis },
    };
    const abilities = (y: FakeYHub, docid: string, who?: string) =>
      cachedAbilities(
        asYHub(y),
        'docs',
        docid,
        who === undefined ? undefined : COOKIE,
        who ?? 'anonymous',
        fetching(),
      );
    const access = () =>
      cachedAccess(asYHub(yhub), 'docs', 'd1', 'user-1', fetching());

    await abilities(yhub, 'd1', 'user-1');
    await abilities(yhub, 'd1');
    await access();
    // another document, and another prefix over the SAME store: neither may
    // be touched by the kick for docs/d1
    await abilities(yhub, 'd2', 'user-1');
    await abilities(otherPrefix, 'd1', 'user-1');
    expect(fetchMock).toHaveBeenCalledTimes(5);

    await invalidateDocumentAuthz(asYHub(yhub), 'docs', 'd1');

    // every entry of docs/d1 is asked for again…
    await abilities(yhub, 'd1', 'user-1');
    await abilities(yhub, 'd1');
    await access();
    expect(fetchMock).toHaveBeenCalledTimes(8);
    // …and the other document and the other prefix are still served
    await abilities(yhub, 'd2', 'user-1');
    await abilities(otherPrefix, 'd1', 'user-1');
    expect(fetchMock).toHaveBeenCalledTimes(8);
  });

  it('is one write of a new generation, expiring past every entry it retires', async () => {
    const { invalidateDocumentAuthz } = await load();

    await invalidateDocumentAuthz(asYHub(yhub), 'docs', 'd1');

    // no key is searched for or deleted: the retired entries expire on their
    // own TTL
    expect(yhub.stream.redis.sets).toHaveLength(1);
    const [{ key, options }] = yhub.stream.redis.sets;
    expect(key).toBe('yhub:authz:gen:{docs:d1}');
    expect(options?.expiration?.type).toBe('PX');
    // the longest TTL is the access one: an entry of the previous generation
    // must be dead before the generation key expires and reads as initial
    expect(options?.expiration?.value).toBeGreaterThan(2 * 300000);
  });

  it('cannot be undone by a fetch that was already in flight', async () => {
    const { cachedAbilities, invalidateDocumentAuthz } = await load();
    let release!: (doc: BackendDocument) => void;
    fetchMock.mockReturnValueOnce(
      new Promise<BackendDocument>((resolve) => (release = resolve)),
    );
    const args = [asYHub(yhub), 'docs', 'd1', COOKIE, 'user-1'] as const;

    const inFlight = cachedAbilities(...args, fetching());
    await new Promise((resolve) => setTimeout(resolve, 5));
    // the revocation lands while the pre-revocation verdict is on its way
    await invalidateDocumentAuthz(asYHub(yhub), 'docs', 'd1');
    release(DOC_ABILITIES);
    await inFlight;

    // that verdict was stored under the retired generation: the next caller
    // reads a miss and gets the post-revocation answer
    fetchMock.mockResolvedValue({ abilities: { retrieve: false } });
    const after = await cachedAbilities(...args, fetching());
    expect(after.abilities.retrieve).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not let a caller after the kick join a fetch started before it', async () => {
    const { cachedAbilities, invalidateDocumentAuthz } = await load();
    let release!: (doc: BackendDocument) => void;
    fetchMock.mockReturnValueOnce(
      new Promise<BackendDocument>((resolve) => (release = resolve)),
    );
    const args = [asYHub(yhub), 'docs', 'd1', COOKIE, 'user-1'] as const;

    const before = cachedAbilities(...args, fetching());
    await new Promise((resolve) => setTimeout(resolve, 5));
    await invalidateDocumentAuthz(asYHub(yhub), 'docs', 'd1');
    fetchMock.mockResolvedValue({ abilities: { retrieve: false } });
    const after = cachedAbilities(...args, fetching());
    await new Promise((resolve) => setTimeout(resolve, 5));
    release(DOC_ABILITIES);

    expect((await before).abilities.retrieve).toBe(true);
    expect((await after).abilities.retrieve).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does nothing when no redis layer is on', async () => {
    vi.stubEnv('YHUB_ABILITIES_CACHE_TTL_MS', '0');
    vi.stubEnv('YHUB_ACCESS_CACHE_TTL_MS', '0');
    const { invalidateDocumentAuthz } = await load();

    await invalidateDocumentAuthz(asYHub(yhub), 'docs', 'd1');
    expect(yhub.stream.redis.sets).toEqual([]);
  });

  it('survives a redis that does not answer: the kick must still be served', async () => {
    const { invalidateDocumentAuthz } = await load();
    yhub.stream.redis.set = async () => {
      throw new Error('redis down');
    };

    await expect(
      invalidateDocumentAuthz(asYHub(yhub), 'docs', 'd1'),
    ).resolves.toBeUndefined();
  });
});

describe('concurrent misses', () => {
  it('share one backend call', async () => {
    let release!: (doc: BackendDocument) => void;
    fetchMock.mockReturnValue(
      new Promise<BackendDocument>((resolve) => (release = resolve)),
    );
    const { cachedAbilities } = await load();
    // anonymous visitors of one public document: the burst this absorbs
    const args = [asYHub(yhub), 'docs', 'd1', undefined, 'anonymous'] as const;

    const lookups = [
      cachedAbilities(...args, fetching()),
      cachedAbilities(...args, fetching()),
      cachedAbilities(...args, fetching()),
    ];
    // let every lookup pass its cache read before the fetch settles
    await new Promise((resolve) => setTimeout(resolve, 5));
    release(DOC_ABILITIES);

    const results = await Promise.all(lookups);
    expect(results.map((r) => r.abilities)).toEqual([
      DOC_ABILITIES.abilities,
      DOC_ABILITIES.abilities,
      DOC_ABILITIES.abilities,
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('do not share a failure beyond the callers that waited for it', async () => {
    fetchMock.mockRejectedValueOnce(new Error('backend down'));
    const { cachedAbilities } = await load();
    const args = [asYHub(yhub), 'docs', 'd1', COOKIE, 'user-1'] as const;

    await expect(cachedAbilities(...args, fetching())).rejects.toThrow(
      'backend down',
    );
    fetchMock.mockResolvedValue(DOC_ABILITIES);
    await expect(cachedAbilities(...args, fetching())).resolves.toMatchObject({
      abilities: DOC_ABILITIES.abilities,
    });
  });
});
