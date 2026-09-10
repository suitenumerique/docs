import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { rememberLocalDoc, sweepLocalDocs } from '../localDocs';

// stands in for the instance's COLLABORATION_LOCAL_DOC_RETENTION_DAYS
const RETENTION_DAYS = 30;
const sweep = (days: number = RETENTION_DAYS) => sweepLocalDocs(days);

/**
 * A Map-backed stand-in for the index database. jsdom has no `indexedDB`, and
 * the module only needs `get` / `put` / `delete` / `getAllKeys` / `close` off
 * one store.
 */
const store = new Map<string, unknown>();

vi.mock('idb', () => ({
  openDB: vi.fn(() =>
    Promise.resolve({
      get: (_s: string, key: string) => Promise.resolve(store.get(key)),
      getAll: (_s: string) => Promise.resolve([...store.values()]),
      getAllKeys: (_s: string) => Promise.resolve([...store.keys()]),
      put: (_s: string, value: unknown, key: string) => {
        store.set(key, value);
        return Promise.resolve(key);
      },
      delete: (_s: string, key: string) => {
        store.delete(key);
        return Promise.resolve();
      },
      close: () => undefined,
    }),
  ),
}));

const mockedClearDocument = vi.fn().mockResolvedValue(undefined);

vi.mock('y-indexeddb', () => ({
  clearDocument: (name: string) => mockedClearDocument(name),
}));

const uuid = (n: number) =>
  `0000000${n}-0000-4000-8000-000000000000`.slice(-36);

const daysAgo = (days: number) => Date.now() - days * 24 * 60 * 60 * 1000;

const seedIndex = (entries: Record<string, number>) => {
  for (const [id, at] of Object.entries(entries)) {
    store.set(id, at);
  }
};

/** Make `indexedDB.databases()` report these names present on the origin. */
const stubDatabases = (names: string[]) =>
  vi.stubGlobal('indexedDB', {
    databases: () => Promise.resolve(names.map((name) => ({ name }))),
  });

describe('localDocs', () => {
  beforeEach(() => {
    store.clear();
    // most tests are about the index alone; the enumeration path is opt-in
    vi.stubGlobal('indexedDB', undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('remembers a document that was opened', async () => {
    await rememberLocalDoc(uuid(1));

    expect(store.get(uuid(1))).toBeGreaterThan(daysAgo(1));
  });

  it('moves a document back out of reach of the sweep when reopened', async () => {
    seedIndex({ [uuid(1)]: daysAgo(90) });

    await rememberLocalDoc(uuid(1));

    expect(await sweep()).toEqual([]);
    expect(mockedClearDocument).not.toHaveBeenCalled();
  });

  it('drops the copies of documents nobody has opened for a month', async () => {
    seedIndex({
      [uuid(1)]: daysAgo(1),
      [uuid(2)]: daysAgo(29),
      [uuid(3)]: daysAgo(31),
      [uuid(4)]: daysAgo(400),
    });

    expect(await sweep()).toEqual([uuid(3), uuid(4)]);
    expect(mockedClearDocument).toHaveBeenCalledWith(uuid(3));
    expect(mockedClearDocument).toHaveBeenCalledWith(uuid(4));
    expect([...store.keys()]).toEqual([uuid(1), uuid(2)]);
  });

  it('keeps a document just inside the limit until it passes it', async () => {
    seedIndex({
      [uuid(1)]: daysAgo(RETENTION_DAYS) + 60_000,
    });

    expect(await sweep()).toEqual([]);
  });

  it('uses the retention window it is given', async () => {
    seedIndex({ [uuid(1)]: daysAgo(3), [uuid(2)]: daysAgo(10) });

    expect(await sweep(7)).toEqual([uuid(2)]);
    expect([...store.keys()]).toEqual([uuid(1)]);
  });

  it('leaves a copy it could not drop in the index, to retry next time', async () => {
    mockedClearDocument.mockRejectedValueOnce(new Error('quota'));
    seedIndex({ [uuid(1)]: daysAgo(90) });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await sweep();

    expect([...store.keys()]).toEqual([uuid(1)]);
  });

  it('does nothing when this browser holds no local copy', async () => {
    expect(await sweep()).toEqual([]);
    expect(mockedClearDocument).not.toHaveBeenCalled();
  });

  describe('enumeration, where the browser supports it', () => {
    it('drops a copy on disk that the index never knew about', async () => {
      stubDatabases([uuid(1), 'api-docs-db', 'docs-local-index']);

      // the index is empty; only the enumeration sees uuid(1)
      expect(await sweep()).toEqual([uuid(1)]);
      expect(mockedClearDocument).toHaveBeenCalledWith(uuid(1));
      // the app's own databases are left alone
      expect(mockedClearDocument).toHaveBeenCalledTimes(1);
    });

    it('keeps an enumerated copy that the index still vouches for', async () => {
      seedIndex({ [uuid(1)]: daysAgo(1) });
      stubDatabases([uuid(1)]);

      expect(await sweep()).toEqual([]);
    });

    it('sweeps the index and the orphans in one pass', async () => {
      seedIndex({ [uuid(1)]: daysAgo(1), [uuid(2)]: daysAgo(90) });
      stubDatabases([uuid(1), uuid(2), uuid(3)]);

      expect((await sweep()).sort()).toEqual([uuid(2), uuid(3)]);
    });
  });

  it('does not hang on a delete the browser blocks', async () => {
    vi.useFakeTimers();
    seedIndex({ [uuid(1)]: daysAgo(90) });
    // a blocked deleteDatabase never resolves
    mockedClearDocument.mockReturnValueOnce(new Promise(() => undefined));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const swept = sweep();
    await vi.advanceTimersByTimeAsync(5000);

    expect(await swept).toEqual([]);
    // still in the index, for the next startup to retry
    expect([...store.keys()]).toEqual([uuid(1)]);
    vi.useRealTimers();
  });
});
