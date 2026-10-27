/**
 * The authz cache: the split-TTL cache that keeps the collaboration path from
 * calling the Docs backend on every connection, every fallback poll and every
 * recheck.
 *
 * Three payloads, three lives, because they do not go stale the same way —
 * see the "Access control" section of README.md:
 *
 *   identity   session-cookie hash → userid. Fails closed downstream (a dead
 *              session still loses the `documents/{id}/abilities` fetch), so
 *              a short in-process TTL with no invalidation is enough. Per
 *              replica: no cross-replica coordination would ever buy anything,
 *              since nothing on the backend side can name this key to
 *              invalidate it.
 *   abilities  the backend's verdict on a (user, document) pair. The one
 *              payload a stale entry would over-grant, so it lives in this
 *              server's own redis — the one already carrying the document
 *              streams, shared between the yhub replicas and never touched
 *              by the backend — where the `reset-connections` endpoint
 *              retires it cluster-wide before the recheck it triggers
 *              re-derives fresh verdicts. Shortest TTL of the three.
 *   access     the `created_at` bounding the history a user may read. A
 *              stored date designed to "re-derive identically on every
 *              recheck" (`permissions.ts`), but not a frozen one: an access
 *              removed then granted again comes back with a later date, and a
 *              stale earlier one would widen the history. Longest TTL, retired
 *              with the abilities on every kick of the document.
 *
 * `0` for a TTL disables that layer: every lookup misses, and the behavior is
 * byte-identical to the uncached path. That is the default, so enabling the
 * cache is a deployment decision (`YHUB_IDENTITY_CACHE_TTL_MS`,
 * `YHUB_ABILITIES_CACHE_TTL_MS`, `YHUB_ACCESS_CACHE_TTL_MS`), and every
 * invalidation question is answerable by turning the knobs to 0.
 */
import { createHash, randomUUID } from 'node:crypto';

import { logger } from '@y/hub';
import { LRUCache } from 'lru-cache';

import {
  ABILITIES_CACHE_TTL_MS,
  ACCESS_CACHE_TTL_MS,
  ANONYMOUS_USERID,
  IDENTITY_CACHE_TTL_MS,
} from './config.js';
import { authzCacheLookups } from './metrics.js';
import type { AccessPayload, DocumentAbilities } from './permissions.js';
import type { BackendDocument } from './backend.js';
import type { YHub } from './yhub.js';

const authzLog = logger.child({ module: 'authz-cache' });

// A session id must never appear as a redis key or a metrics label: keys are
// logged, scraped and expire on their own schedule, and a session id is a
// bearer credential. Only its SHA-256 travels.
export const hashCookie = (cookie: string): string =>
  createHash('sha256').update(cookie).digest('hex');

// The `documents/{id}/abilities` for a caller with no session at all depend
// only on the document's link configuration — every anonymous visitor holds
// the same verdict — so they share one redis key per document instead of one
// per cookie hash. (The 401-fallback anonymous caller — a dead session —
// shares it too: the backend sees an unauthenticated user in both cases.)
// a key segment, not an identity — distinct from ANONYMOUS_USERID, which is
// a userid that also flows into attributions and recheck targeting
const ANONYMOUS_KEY_PART = 'anon';

/*
 * Invalidation by generation. Every document has a generation key holding a
 * random token, and every cached entry stores the generation it was read
 * under next to its value. A lookup reads both with one MGET — their names are
 * known up front — and an entry whose generation is not the current one is a
 * miss. Invalidating a document is then a single SET of a new generation: no
 * key has to be found or deleted, the retired entries are never read again and
 * expire on their own TTL.
 *
 * `{org:docid}` is a redis hash tag: every key of one document lands in the
 * same slot, which MGET requires should this redis ever become a cluster.
 */
type Layer = 'abilities' | 'access';

// The generation of a document that was never invalidated, or whose
// generation key has expired.
const INITIAL_GENERATION = '0';

const documentTag = (org: string, docid: string) => `{${org}:${docid}}`;

const generationKey = (yhub: YHub, org: string, docid: string) =>
  `${yhub.stream.prefix}:authz:gen:${documentTag(org, docid)}`;

const entryKey = (
  yhub: YHub,
  layer: Layer,
  org: string,
  docid: string,
  who: string,
) => `${yhub.stream.prefix}:authz:${layer}:${documentTag(org, docid)}:${who}`;

interface Entry<T> {
  gen: string;
  value: T;
}

export interface CachedAbilities {
  abilities: DocumentAbilities;
  // Whether the verdict belongs to an identified user (and therefore may come
  // with an access date) or to an anonymous visitor. The `accesses/me` call is
  // only ever made for an identified user: an anonymous visitor holds no
  // access row, so `resolveHistoryFrom` is short-circuited instead of asked.
  identified: boolean;
}
/**
 * The identity cache: session-cookie hash → userid, per replica. Keyed on the
 * whole Cookie header (a caller whose header changes in a way that keeps the
 * session cookie merely costs a miss, never a wrong identity: the mapping is
 * read back from the backend on the miss path), short TTL, and nothing
 * invalidates it — logout simply keeps resolving through the stale userid for
 * at most one TTL, and then the dead session 401s at the abilities fetch,
 * which denies.
 */
class IdentityCache {
  // One entry per live caller session; a poll every few seconds across a busy
  // deployment is exactly the traffic this cache exists to absorb. When full,
  // the least recently used session goes first. lru-cache reads a TTL of 0 as
  // "never expires", so a disabled layer is guarded in `get`/`set` instead.
  private readonly entries = new LRUCache<string, string>({
    max: 100_000,
    ttl: Math.max(IDENTITY_CACHE_TTL_MS, 1),
  });

  get(cookie: string): string | undefined {
    if (IDENTITY_CACHE_TTL_MS <= 0) return undefined;
    const userid = this.entries.get(hashCookie(cookie));
    authzCacheLookups.inc({
      layer: 'identity',
      result: userid === undefined ? 'miss' : 'hit',
    });
    return userid;
  }

  set(cookie: string, userid: string): void {
    if (IDENTITY_CACHE_TTL_MS <= 0) return;
    this.entries.set(hashCookie(cookie), userid);
  }
}

export const identityCache = new IdentityCache();

// The fetches in flight, by entry and generation. Concurrent misses of one
// entry wait for the fetch already running instead of each starting their
// own — a burst of anonymous visitors on a public document costs one backend
// call per replica — and a caller arriving after an invalidation never joins a
// fetch started before it, since the generation is part of the key.
const flights = new Map<string, Promise<unknown>>();

/**
 * The read-through behind the two redis layers.
 *
 * The generation is read *before* `fetch`, and the answer is stored under that
 * generation: a fetch already in flight when a kick lands stores its
 * pre-revocation verdict under the retired generation, where every later
 * lookup reads a miss. At worst it overwrites a fresher entry, which costs the
 * next caller a fetch, never a stale verdict.
 *
 * A redis that does not answer is a cache that does not answer: read through
 * to the backend rather than fail the connection, and store nothing, since no
 * generation was read. An error from `fetch` is never cached — a backend that
 * did not answer is not a permission decision.
 */
const getOrFetch = async <T>(
  yhub: YHub,
  layer: Layer,
  ttlMs: number,
  org: string,
  docid: string,
  who: string,
  fetch: () => Promise<T>,
): Promise<T> => {
  if (ttlMs <= 0) return fetch();
  const { redis } = yhub.stream;
  const key = entryKey(yhub, layer, org, docid, who);

  let gen: string | null = null;
  try {
    const [current, stored] = await redis.mGet([
      generationKey(yhub, org, docid),
      key,
    ]);
    gen = current ?? INITIAL_GENERATION;
    if (stored != null) {
      const entry = JSON.parse(stored) as Entry<T>;
      if (entry.gen === gen) {
        authzCacheLookups.inc({ layer, result: 'hit' });
        return entry.value;
      }
    }
  } catch {
    authzLog.warn({ key }, 'authz cache read failed, fetching fresh');
  }
  authzCacheLookups.inc({ layer, result: 'miss' });
  if (gen == null) return fetch();

  const readGen = gen;
  const flightKey = `${key}@${readGen}`;
  const running = flights.get(flightKey) as Promise<T> | undefined;
  if (running != null) return running;

  const flight = (async () => {
    const value = await fetch();
    const entry: Entry<T> = { gen: readGen, value };
    try {
      await redis.set(key, JSON.stringify(entry), {
        expiration: { type: 'PX', value: ttlMs },
      });
    } catch (err) {
      authzLog.warn({ key, err }, 'authz cache write failed');
    }
    return value;
  })().finally(() => flights.delete(flightKey));
  flights.set(flightKey, flight);
  return flight;
};

/**
 * The abilities lookup for one (caller, document) pair. `fetch` is called only
 * on a miss and must resolve the caller's `documents/{id}/abilities` payload —
 * its `abilities` object is what gets cached (the rest of the payload is not
 * part of the verdict); on a backend error the lookup rethrows.
 */
export const cachedAbilities = async (
  yhub: YHub,
  org: string,
  docid: string,
  cookie: string | undefined,
  userid: string,
  fetch: () => Promise<BackendDocument>,
): Promise<CachedAbilities> => {
  // An anonymous caller holds no identity: their verdict is the document's
  // link configuration, shared with every other anonymous visitor. Callers
  // that carry a cookie but resolved anonymous through the 401 fallback share
  // it too — the backend sees them unauthenticated either way.
  const identified = userid !== ANONYMOUS_USERID && cookie !== undefined;
  const abilities = await getOrFetch<DocumentAbilities>(
    yhub,
    'abilities',
    ABILITIES_CACHE_TTL_MS,
    org,
    docid,
    identified ? hashCookie(cookie) : ANONYMOUS_KEY_PART,
    async () => {
      const doc = await fetch();
      return {
        retrieve: doc.abilities?.retrieve,
        update: doc.abilities?.update,
        versions_list: doc.abilities?.versions_list,
      };
    },
  );
  return { abilities, identified };
};

/**
 * The access lookup for one (identified user, document) pair — the
 * `accesses/me/` payload whose `created_at` bounds the history they may read.
 * Only called for identified users holding `versions_list`; `fetch` resolves
 * the backend's payload on a miss. The payload is cached raw — parsing it into
 * a date stays `resolveHistoryFrom`'s job, so every rule about unusable
 * answers (zero, unparsable, refusal) keeps a single home. A `null` answer
 * (no access row — the abilities and the access disagreeing) is cached too,
 * for the same TTL: a revoked reader whose abilities verdict has not expired
 * yet must not re-derive an older date from a fresh fetch either.
 */
export const cachedAccess = (
  yhub: YHub,
  org: string,
  docid: string,
  userid: string,
  fetch: () => Promise<AccessPayload | null>,
): Promise<AccessPayload | null> =>
  getOrFetch<AccessPayload | null>(
    yhub,
    'access',
    ACCESS_CACHE_TTL_MS,
    org,
    docid,
    userid,
    async () => (await fetch()) ?? null,
  );

/**
 * Retire every cached verdict for one document, cluster-wide, with one write.
 * Called by the `reset-connections` endpoint before it triggers the recheck:
 * the recheck re-runs `authorize` with the connections' stored authInfo, and a
 * verdict served from cache there would be the pre-revocation one.
 *
 * The generation key expires too, so a document kicked once does not hold a
 * key forever. Its lifetime must outlast every entry written under the
 * previous generation — those read as current again once the key is gone —
 * hence twice the longest TTL plus a margin for a fetch still in flight. A
 * redis that does not answer must not fail the kick: the recheck then reads
 * *some* fresh verdicts and the TTL bounds the rest.
 */
export const invalidateDocumentAuthz = async (
  yhub: YHub,
  org: string,
  docid: string,
): Promise<void> => {
  const maxTtlMs = Math.max(ABILITIES_CACHE_TTL_MS, ACCESS_CACHE_TTL_MS);
  if (maxTtlMs <= 0) return;
  try {
    await yhub.stream.redis.set(generationKey(yhub, org, docid), randomUUID(), {
      expiration: { type: 'PX', value: 2 * maxTtlMs + 60_000 },
    });
    authzLog.debug({ org, docid }, 'authz cache invalidated');
  } catch (err) {
    authzLog.warn({ org, docid, err }, 'authz cache invalidation failed');
  }
};
