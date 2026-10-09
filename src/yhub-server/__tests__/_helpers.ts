// Shared fixtures and fakes for the vitest specs. Named `_helpers.ts` (not a
// `*.spec.ts`) so the runner's `include` glob never picks it up as a suite.

import { vi } from 'vitest';

import * as Y from '@y/y';

import type { YHub } from '../src/yhub.js';

// --- Yjs fixtures ---------------------------------------------------------

// A raw Yjs update (what the legacy S3 object base64-decodes to) for a text
// document holding `text`. Deterministic: one client, one insert.
export const makeUpdate = (text = 'hello world'): Uint8Array<ArrayBuffer> => {
  const doc = new Y.Doc();
  doc.get('t', 'text').insert(0, text);
  return Y.encodeStateAsUpdate(doc);
};

// A sequence of *full snapshots* of one lineage, the shape `{docid}/file`'s S3
// versions have: each element is `encodeStateAsUpdate` after one more edit, so
// applying them in order to a gc:false doc yields fresh content ids per step.
export const makeVersionChain = (
  steps = ['a', 'bc', 'def'],
): Uint8Array<ArrayBuffer>[] => {
  const doc = new Y.Doc();
  const text = doc.get('t', 'text');
  const updates: Uint8Array<ArrayBuffer>[] = [];
  for (const step of steps) {
    text.insert(text.length, step);
    updates.push(Y.encodeStateAsUpdate(doc));
  }
  return updates;
};

export const toBase64 = (update: Uint8Array): string =>
  Buffer.from(update).toString('base64');

// What `fetchLegacyDoc` reads back: a Body with `transformToString`.
export const s3Body = (update: Uint8Array) => ({
  transformToString: async () => toBase64(update),
});

// A GetObject rejection the sdk would raise for an absent key/version.
export const s3NotFound = (name = 'NoSuchKey'): Error =>
  Object.assign(new Error(name), { name });

// --- a minimal in-memory redis -----------------------------------------

// Enough of the client for the lock dance and the migrated set. `set` honors
// the `NX` condition migration.ts relies on; `eval` emulates the compare-and-
// delete lua script it releases the lock with.
export const fakeRedis = () => {
  const kv = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  const setOf = (k: string): Set<string> => {
    let set = sets.get(k);
    if (!set) {
      set = new Set();
      sets.set(k, set);
    }
    return set;
  };
  return {
    kv,
    sets,
    sIsMember: vi.fn(async (k: string, m: string) => setOf(k).has(m)),
    sAdd: vi.fn(async (k: string, m: string) => void setOf(k).add(m)),
    set: vi.fn(
      async (
        k: string,
        v: string,
        opts?: { condition?: string },
      ): Promise<string | null> => {
        if (opts?.condition === 'NX' && kv.has(k)) return null;
        kv.set(k, v);
        return 'OK';
      },
    ),
    exists: vi.fn(async (k: string) => (kv.has(k) ? 1 : 0)),
    del: vi.fn(async (k: string) => void kv.delete(k)),
    eval: vi.fn(
      async (
        _script: string,
        { keys, arguments: args }: { keys: string[]; arguments: string[] },
      ) => {
        if (kv.get(keys[0]) === args[0]) {
          kv.delete(keys[0]);
          return 1;
        }
        return 0;
      },
    ),
  };
};

// --- a fake yhub instance ---------------------------------------------

type AnyRecord = Record<string, unknown>;

// The surface migration.ts touches, all as vi.fns with harmless defaults. Pass
// overrides for the handful a given test drives; reach into `.stream.redis`
// (a fakeRedis) for the lock/set state. Cast to `YHub` at the boundary — the
// functions under test only ever touch this subset.
export const makeYhub = (overrides: AnyRecord = {}): YHub => {
  const redis = (overrides.redis as ReturnType<typeof fakeRedis>) ?? fakeRedis();
  const yhub: AnyRecord = {
    stream: {
      prefix: 'yhub',
      redis,
      // ydocExists: no messages on the stream by default
      getMessages: vi.fn(async () => [{ messages: [] }]),
      addMessage: vi.fn(async () => {}),
    },
    persistence: {
      // ydocExists: lastClock '0' means "yhub does not know this room"
      retrieveDoc: vi.fn(async () => ({ lastClock: '0' })),
      store: vi.fn(async () => {}),
    },
    computePool: {
      // fullMigrate merges the nongc snapshot into a gc one; hand a marker back
      mergeUpdates: vi.fn(async (_gc: boolean, [update]: Uint8Array[]) => update),
    },
  };
  return deepAssign(yhub, overrides) as unknown as YHub;
};

const deepAssign = (target: AnyRecord, source: AnyRecord): AnyRecord => {
  for (const [key, value] of Object.entries(source)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof value !== 'function' &&
      target[key]
    ) {
      deepAssign(target[key] as AnyRecord, value as AnyRecord);
    } else {
      target[key] = value;
    }
  }
  return target;
};

// A stand-in for `@y/hub`'s pino logger: swallow the lines, keep the spies.
export const fakeLoggerModule = () => {
  const record = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
  const child = () => ({ ...record, child });
  return { logger: { ...record, child } };
};
