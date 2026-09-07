// Shared fixtures and fakes for the vitest specs. Named `.mjs` (not `.js`) so
// neither the Dockerfile's `COPY *.js` nor `node --test` ever picks it up, and
// `*.spec.mjs` so the same is true of the spec files themselves.

import { vi } from 'vitest';

import * as Y from '@y/y';

// --- Yjs fixtures ---------------------------------------------------------

// A raw Yjs update (what the legacy S3 object base64-decodes to) for a text
// document holding `text`. Deterministic: one client, one insert.
export const makeUpdate = (text = 'hello world') => {
  const doc = new Y.Doc();
  doc.get('t', 'text').insert(0, text);
  return Y.encodeStateAsUpdate(doc);
};

// A sequence of *full snapshots* of one lineage, the shape `{docid}/file`'s S3
// versions have: each element is `encodeStateAsUpdate` after one more edit, so
// applying them in order to a gc:false doc yields fresh content ids per step.
export const makeVersionChain = (steps = ['a', 'bc', 'def']) => {
  const doc = new Y.Doc();
  const text = doc.get('t', 'text');
  const updates = [];
  for (const step of steps) {
    text.insert(text.length, step);
    updates.push(Y.encodeStateAsUpdate(doc));
  }
  return updates;
};

export const toBase64 = (update) => Buffer.from(update).toString('base64');

// What `fetchLegacyDoc` reads back: a Body with `transformToString`.
export const s3Body = (update) => ({
  transformToString: async () => toBase64(update),
});

// A GetObject rejection the sdk would raise for an absent key/version.
export const s3NotFound = (name = 'NoSuchKey') =>
  Object.assign(new Error(name), { name });

// --- a minimal in-memory redis -----------------------------------------

// Enough of the client for the lock dance and the migrated set. `set` honors
// the `NX` condition migrate.js relies on; `eval` emulates the compare-and-
// delete lua script it releases the lock with.
export const fakeRedis = () => {
  const kv = new Map();
  const sets = new Map();
  const setOf = (k) => sets.get(k) ?? sets.set(k, new Set()).get(k);
  return {
    kv,
    sets,
    sIsMember: vi.fn(async (k, m) => setOf(k).has(m)),
    sAdd: vi.fn(async (k, m) => void setOf(k).add(m)),
    set: vi.fn(async (k, v, opts) => {
      if (opts?.condition === 'NX' && kv.has(k)) return null;
      kv.set(k, v);
      return 'OK';
    }),
    exists: vi.fn(async (k) => (kv.has(k) ? 1 : 0)),
    del: vi.fn(async (k) => void kv.delete(k)),
    eval: vi.fn(async (_script, { keys, arguments: args }) => {
      if (kv.get(keys[0]) === args[0]) {
        kv.delete(keys[0]);
        return 1;
      }
      return 0;
    }),
  };
};

// --- a fake yhub instance ---------------------------------------------

// The surface migration.js touches, all as vi.fns with harmless defaults. Pass
// overrides for the handful a given test drives; reach into `.stream.redis`
// (a fakeRedis) for the lock/set state.
export const makeYhub = (overrides = {}) => {
  const redis = overrides.redis ?? fakeRedis();
  const yhub = {
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
      mergeUpdates: vi.fn(async (_gc, [update]) => update),
    },
  };
  return deepAssign(yhub, overrides);
};

const deepAssign = (target, source) => {
  for (const [key, value] of Object.entries(source)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof value !== 'function' &&
      target[key]
    ) {
      deepAssign(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
};

// A stand-in for `@y/hub`'s pino logger: swallow the lines, keep the spies.
export const fakeLoggerModule = () => {
  const record = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  const child = () => ({ ...record, child });
  return { logger: { ...record, child } };
};
