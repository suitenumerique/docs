// migration.ts — the legacy Django/S3 document store reader.
//
// The two entry points server.ts calls are exercised end to end here:
//   maybeMigrate — the lazy seed on first access to an unknown room
//   fullMigrate  — the version-history backfill
// with `@aws-sdk/client-s3` and the yhub instance faked, and `@y/y` real, so the
// content maps these build are the real ones.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import * as Y from '@y/y';

// the faked yhub methods are `vi.fn()`s behind a `YHub` cast — reach their
// recorded calls through this rather than sprinkling casts
const mockCalls = (fn: unknown): unknown[][] => (fn as Mock).mock.calls;

import {
  makeUpdate,
  makeVersionChain,
  makeYhub,
  fakeRedis,
  s3Body,
  s3NotFound,
} from './_helpers.js';

// migration.ts reads these once, at import time, and builds its S3 client from
// them. Set before the module is ever imported (below), overriding the floor
// vitest.config.mts puts down.
process.env.SOFT_MIGRATION = 'true';
process.env.LEGACY_S3_ENDPOINT_URL = 'https://legacy.example.test';
process.env.LEGACY_S3_ACCESS_KEY_ID = 'legacy-key';
process.env.LEGACY_S3_SECRET_ACCESS_KEY = 'legacy-secret';
process.env.LEGACY_S3_BUCKET_NAME = 'legacy-media';
delete process.env.LEGACY_S3_SIGNATURE_VERSION;
delete process.env.LEGACY_S3_REGION_NAME;

// One send() spy for the whole file; every S3Client the module builds routes
// here. `s3configs` captures each client's constructor config.
const { s3send, s3configs } = vi.hoisted(() => ({
  s3send: vi.fn(),
  s3configs: [] as any[],
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    constructor(config: unknown) {
      s3configs.push(config);
    }
    send(command: unknown, options: unknown) {
      return s3send(command, options);
    }
  },
  GetObjectCommand: class {
    input: unknown;
    kind = 'get';
    constructor(input: unknown) {
      this.input = input;
    }
  },
  ListObjectVersionsCommand: class {
    input: unknown;
    kind = 'list';
    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

vi.mock('@y/hub', () => {
  const rec = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  const child = () => ({ ...rec, child });
  return { logger: { ...rec, child } };
});

const load = () => import('../src/migration.js');
const docRef = (docid = 'doc-1') => ({ org: 'docs', docid, branch: 'main' });
const LOCK_KEY = 'yhub:softmigrate:docs:doc-1:main';
const MIGRATED_SET = 'yhub:migrated:v1';

// Route S3 by command. `getByVersion` maps a VersionId to a Body (or an Error to
// throw); `get` handles the versionless "newest object" read; `list` is the
// ListObjectVersions response (or a function of its input).
interface RouteS3Opts {
  getByVersion?: Record<string, unknown>;
  get?: (input: any) => unknown;
  list?: unknown;
}
const routeS3 = ({ getByVersion, get, list }: RouteS3Opts = {}) => {
  s3send.mockImplementation(async (command: any) => {
    if (command.kind === 'get') {
      const versionId = command.input.VersionId;
      if (versionId != null && getByVersion) {
        if (!(versionId in getByVersion)) throw s3NotFound('NoSuchVersion');
        const entry = getByVersion[versionId];
        if (entry instanceof Error) throw entry;
        return { Body: entry };
      }
      if (get) return get(command.input);
      return { Body: s3Body(makeUpdate()) };
    }
    if (command.kind === 'list') {
      return typeof list === 'function'
        ? list(command.input)
        : (list ?? { Versions: [], IsTruncated: false });
    }
    throw new Error(`unexpected S3 command: ${command.kind}`);
  });
};

// The [name, value] attribute pairs a stored/seeded content map carries.
const attrsOf = (contentmapBytes: Uint8Array) => {
  const decoded = Y.decodeContentMap(contentmapBytes) as any;
  const out: { inserts: unknown[][]; deletes: unknown[][] } = {
    inserts: [],
    deletes: [],
  };
  for (const side of ['inserts', 'deletes'] as const) {
    for (const [, entry] of decoded[side].clients) {
      for (const id of entry._ids) {
        for (const attr of id.attrs) out[side].push([attr.name, attr.val]);
      }
    }
  }
  return out;
};

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  s3send.mockReset();
  s3configs.length = 0;
});

describe('module load', () => {

  it('refuses to boot when SOFT_MIGRATION is set without credentials', async () => {
    vi.stubEnv('LEGACY_S3_ACCESS_KEY_ID', '');
    vi.resetModules();
    await expect(load()).rejects.toThrow(/requires LEGACY_S3_/);
  });

  it('refuses an endpoint URL that carries a path', async () => {
    vi.stubEnv('LEGACY_S3_ENDPOINT_URL', 'https://legacy.example.test/media');
    vi.resetModules();
    await expect(load()).rejects.toThrow(/must not contain a path/);
  });

  it('refuses a SigV2 signature version', async () => {
    vi.stubEnv('LEGACY_S3_SIGNATURE_VERSION', 's3');
    vi.resetModules();
    await expect(load()).rejects.toThrow(
      /LEGACY_S3_SIGNATURE_VERSION must be one of/,
    );
  });

  it('accepts the v4 spelling of the signature version', async () => {
    vi.stubEnv('LEGACY_S3_SIGNATURE_VERSION', 'v4');
    vi.resetModules();
    const mod = await load();
    expect(mod.SOFT_MIGRATION).toBe(true);
  });

  it('addresses a self-hosted endpoint path-style and defaults the region', async () => {
    vi.resetModules();
    await load();
    const config = s3configs.at(-1);
    expect(config.forcePathStyle).toBe(true);
    expect(config.region).toBe('us-east-1');
    expect(config.authSchemePreference).toEqual(['aws.auth#sigv4']);
  });

  it('addresses an amazonaws.com endpoint virtual-host-style', async () => {
    vi.stubEnv('LEGACY_S3_ENDPOINT_URL', 'https://s3.eu-west-3.amazonaws.com');
    vi.resetModules();
    await load();
    expect(s3configs.at(-1).forcePathStyle).toBe(false);
  });

  it('builds no S3 client when SOFT_MIGRATION is off', async () => {
    vi.stubEnv('SOFT_MIGRATION', 'false');
    vi.resetModules();
    const mod = await load();
    expect(mod.SOFT_MIGRATION).toBe(false);
    expect(s3configs).toHaveLength(0);
  });
});

describe('isPermanentFailure', () => {
  it('is true only for an error marked permanent', async () => {
    const { isPermanentFailure } = await load();
    expect(isPermanentFailure(Object.assign(new Error(), { permanent: true }))).toBe(
      true,
    );
    expect(isPermanentFailure(new Error('network'))).toBe(false);
    expect(isPermanentFailure(undefined)).toBe(false);
  });
});

describe('maybeMigrate — the lazy seed', () => {
  it('seeds an unknown room from the newest legacy object', async () => {
    const update = makeUpdate('hello world');
    routeS3({ get: () => ({ Body: s3Body(update) }) });
    const { maybeMigrate } = await load();
    const yhub = makeYhub();

    await maybeMigrate(yhub, docRef());

    expect(yhub.stream.addMessage).toHaveBeenCalledTimes(1);
    const [ref, message] = mockCalls(yhub.stream.addMessage)[0] as [
      unknown,
      any,
    ];
    expect(ref).toEqual(docRef());
    expect(message.type).toBe('ydoc:update:v1');
    expect(Buffer.from(message.update)).toEqual(Buffer.from(update));
    expect(message.contentmap).toBeInstanceOf(Uint8Array);

    const get = s3send.mock.calls.find(([c]: any) => c.kind === 'get')![0];
    expect(get.input).toEqual({ Bucket: 'legacy-media', Key: 'doc-1/file' });
  });

  it('attributes the seed to system/s3 and stamps no timestamp', async () => {
    routeS3({ get: () => ({ Body: s3Body(makeUpdate()) }) });
    const { maybeMigrate } = await load();
    const yhub = makeYhub();

    await maybeMigrate(yhub, docRef());

    const { contentmap } = mockCalls(yhub.stream.addMessage)[0][1] as any;
    const { inserts } = attrsOf(contentmap);
    expect(inserts).toContainEqual(['insert', 'system']);
    expect(inserts).toContainEqual(['insert:migration', 's3']);
    expect(inserts.map(([name]) => name)).not.toContain('insertAt');
  });

  it('does not seed a room yhub already persisted', async () => {
    routeS3();
    const { maybeMigrate } = await load();
    const yhub = makeYhub({
      persistence: { retrieveDoc: vi.fn(async () => ({ lastClock: '7' })) },
    });

    await maybeMigrate(yhub, docRef());

    expect(yhub.stream.addMessage).not.toHaveBeenCalled();
    expect(s3send).not.toHaveBeenCalled();
  });

  it('does not seed a room that already has an update on the stream', async () => {
    routeS3();
    const { maybeMigrate } = await load();
    const yhub = makeYhub({
      stream: {
        getMessages: vi.fn(async () => [
          { messages: [{ type: 'ydoc:update:v1' }] },
        ]),
      },
    });

    await maybeMigrate(yhub, docRef());

    expect(yhub.stream.addMessage).not.toHaveBeenCalled();
  });

  it('ignores non-content messages when probing the stream', async () => {
    routeS3({ get: () => ({ Body: s3Body(makeUpdate()) }) });
    const { maybeMigrate } = await load();
    const yhub = makeYhub({
      stream: {
        getMessages: vi.fn(async () => [
          { messages: [{ type: 'awareness:v1' }, { type: 'auth-check:v1' }] },
        ]),
      },
    });

    await maybeMigrate(yhub, docRef());

    expect(yhub.stream.addMessage).toHaveBeenCalledTimes(1);
  });

  it.each(['NoSuchKey', 'NoSuchVersion', 'NotFound'])(
    'treats a %s from S3 as an empty room, not an error',
    async (name) => {
      routeS3({ get: () => { throw s3NotFound(name); } });
      const { maybeMigrate } = await load();
      const yhub = makeYhub();

      await expect(maybeMigrate(yhub, docRef())).resolves.toBeUndefined();
      expect(yhub.stream.addMessage).not.toHaveBeenCalled();
    },
  );

  it('rejects, permanently, a legacy object that is not a valid Yjs update', async () => {
    routeS3({ get: () => ({ Body: s3Body(new Uint8Array([1, 2, 3, 4, 5, 6])) }) });
    const { maybeMigrate, isPermanentFailure } = await load();
    const yhub = makeYhub();

    const err = await maybeMigrate(yhub, docRef()).catch((e) => e);
    expect(isPermanentFailure(err)).toBe(true);
    expect(yhub.stream.addMessage).not.toHaveBeenCalled();
  });

  it('caches a permanent failure: a second access does not re-fetch S3', async () => {
    routeS3({ get: () => ({ Body: s3Body(new Uint8Array([9, 9, 9, 9, 9, 9])) }) });
    const { maybeMigrate } = await load();
    const yhub = makeYhub();

    await maybeMigrate(yhub, docRef()).catch(() => {});
    await maybeMigrate(yhub, docRef()).catch(() => {});

    expect(s3send.mock.calls.filter(([c]) => c.kind === 'get')).toHaveLength(1);
  });

  it('caches the empty verdict: a second access does not re-fetch S3', async () => {
    routeS3({ get: () => { throw s3NotFound('NoSuchKey'); } });
    const { maybeMigrate } = await load();
    const yhub = makeYhub();

    await maybeMigrate(yhub, docRef());
    await maybeMigrate(yhub, docRef());

    expect(s3send.mock.calls.filter(([c]) => c.kind === 'get')).toHaveLength(1);
  });

  it('reports a network error as retryable, not permanent', async () => {
    routeS3({ get: () => { throw new Error('ECONNRESET'); } });
    const { maybeMigrate, isPermanentFailure } = await load();
    const yhub = makeYhub();

    const err = await maybeMigrate(yhub, docRef()).catch((e) => e);
    expect(isPermanentFailure(err)).toBe(false);
  });

  it('collapses concurrent first-connections to one S3 fetch and one seed', async () => {
    routeS3({ get: () => ({ Body: s3Body(makeUpdate()) }) });
    const { maybeMigrate } = await load();
    const yhub = makeYhub();

    await Promise.all([
      maybeMigrate(yhub, docRef()),
      maybeMigrate(yhub, docRef()),
      maybeMigrate(yhub, docRef()),
    ]);

    expect(s3send.mock.calls.filter(([c]) => c.kind === 'get')).toHaveLength(1);
    expect(yhub.stream.addMessage).toHaveBeenCalledTimes(1);
  });

  it('releases its own migrate lock with a compare-and-delete', async () => {
    routeS3({ get: () => ({ Body: s3Body(makeUpdate()) }) });
    const { maybeMigrate } = await load();
    const redis = fakeRedis();
    const yhub = makeYhub({ redis });

    await maybeMigrate(yhub, docRef());

    expect(redis.eval).toHaveBeenCalledTimes(1);
    expect(redis.kv.has(LOCK_KEY)).toBe(false);
  });

  it('seeds itself when another seeder held the lock but left the room empty', async () => {
    routeS3({ get: () => ({ Body: s3Body(makeUpdate()) }) });
    const { maybeMigrate } = await load();
    const redis = fakeRedis();
    redis.kv.set(LOCK_KEY, 'another-replica');
    // the other seeder's lock has already gone by the time we re-probe
    redis.exists = vi.fn(async () => 0);
    const yhub = makeYhub({ redis });

    await maybeMigrate(yhub, docRef());

    expect(yhub.stream.addMessage).toHaveBeenCalledTimes(1);
    // acquired nothing, so it must not touch the other replica's lock
    expect(redis.eval).not.toHaveBeenCalled();
  });

  it('skips the S3 round-trip for a fully migrated room', async () => {
    routeS3();
    const { maybeMigrate } = await load();
    const redis = fakeRedis();
    await redis.sAdd(MIGRATED_SET, 'doc-1');
    const yhub = makeYhub({ redis });

    await maybeMigrate(yhub, docRef());

    expect(s3send).not.toHaveBeenCalled();
    expect(yhub.stream.addMessage).not.toHaveBeenCalled();
  });
});

describe('fullMigrate — the version-history backfill', () => {
  const listNewestFirst = (
    entries: Array<{ versionId: string; ms: number }>,
  ) => ({
    Versions: entries.map(({ versionId, ms }) => ({
      Key: 'doc-1/file',
      VersionId: versionId,
      LastModified: new Date(ms),
    })),
    IsTruncated: false,
  });

  it('reports an empty status when there is no legacy object', async () => {
    routeS3({ list: { Versions: [], IsTruncated: false } });
    const { fullMigrate } = await load();
    const yhub = makeYhub();

    const result = await fullMigrate(yhub, docRef());

    expect(result).toMatchObject({ status: 'empty', versions: 0 });
    expect(yhub.persistence.store).not.toHaveBeenCalled();
  });

  it('replays every version oldest-first into one clock-0 row', async () => {
    const [v1, v2] = makeVersionChain(['a', 'bc']);
    routeS3({
      list: listNewestFirst([
        { versionId: 'ver-2', ms: 2000 },
        { versionId: 'ver-1', ms: 1000 },
      ]),
      getByVersion: { 'ver-1': s3Body(v1), 'ver-2': s3Body(v2) },
    });
    const { fullMigrate } = await load();
    const redis = fakeRedis();
    const yhub = makeYhub({ redis });

    const result = await fullMigrate(yhub, docRef());

    expect(result).toMatchObject({
      status: 'ok',
      versions: 2,
      applied: 2,
      skipped: 0,
      dropped: 0,
    });

    // fetched in ascending-timestamp order, not the order S3 listed them
    const fetchedVersionIds = s3send.mock.calls
      .filter(([c]) => c.kind === 'get')
      .map(([c]) => c.input.VersionId);
    expect(fetchedVersionIds).toEqual(['ver-1', 'ver-2']);

    expect(yhub.persistence.store).toHaveBeenCalledTimes(1);
    const [ref, row] = mockCalls(yhub.persistence.store)[0] as [unknown, any];
    expect(ref).toEqual(docRef());
    expect(row.lastClock).toBe('0');
    expect(row.contentmap).toBeInstanceOf(Uint8Array);
    expect(row.contentids).toBeInstanceOf(Uint8Array);

    expect(redis.sets.get(MIGRATED_SET)).toEqual(new Set(['doc-1']));
  });

  it("stamps each version's content with that version's S3 timestamp", async () => {
    const [v1, v2] = makeVersionChain(['a', 'bc']);
    routeS3({
      list: listNewestFirst([
        { versionId: 'ver-2', ms: 2000 },
        { versionId: 'ver-1', ms: 1000 },
      ]),
      getByVersion: { 'ver-1': s3Body(v1), 'ver-2': s3Body(v2) },
    });
    const { fullMigrate } = await load();
    const yhub = makeYhub();

    await fullMigrate(yhub, docRef());

    const { inserts } = attrsOf(
      (mockCalls(yhub.persistence.store)[0][1] as any).contentmap,
    );
    expect(inserts).toContainEqual(['insert', 'system']);
    expect(inserts).toContainEqual(['insertAt', 1000]);
    expect(inserts).toContainEqual(['insertAt', 2000]);
  });

  it('leaves a document already in the migrated set untouched', async () => {
    routeS3();
    const { fullMigrate } = await load();
    const redis = fakeRedis();
    await redis.sAdd(MIGRATED_SET, 'doc-1');
    const yhub = makeYhub({ redis });

    const result = await fullMigrate(yhub, docRef());

    expect(result).toEqual({ status: 'already' });
    expect(s3send).not.toHaveBeenCalled();
  });

  it('force replays a document that is already in the set', async () => {
    routeS3({
      list: listNewestFirst([{ versionId: 'ver-1', ms: 1000 }]),
      getByVersion: { 'ver-1': s3Body(makeUpdate()) },
    });
    const { fullMigrate } = await load();
    const redis = fakeRedis();
    await redis.sAdd(MIGRATED_SET, 'doc-1');
    const yhub = makeYhub({ redis });

    const result = await fullMigrate(yhub, docRef(), { force: true });

    expect(result.status).toBe('ok');
    expect(yhub.persistence.store).toHaveBeenCalledTimes(1);
  });

  it('skips a corrupt version and keeps going', async () => {
    const [, v2] = makeVersionChain(['a', 'bc']);
    routeS3({
      list: listNewestFirst([
        { versionId: 'ver-2', ms: 2000 },
        { versionId: 'ver-1', ms: 1000 },
      ]),
      getByVersion: {
        'ver-1': s3Body(new Uint8Array([1, 2, 3, 4, 5])),
        'ver-2': s3Body(v2),
      },
    });
    const { fullMigrate } = await load();
    const yhub = makeYhub();

    const result = await fullMigrate(yhub, docRef());

    expect(result).toMatchObject({ status: 'ok', applied: 1, skipped: 1 });
  });

  it('reports "nothing" and does not remember a document with no readable version', async () => {
    routeS3({
      list: listNewestFirst([
        { versionId: 'ver-2', ms: 2000 },
        { versionId: 'ver-1', ms: 1000 },
      ]),
      getByVersion: {
        'ver-1': s3Body(new Uint8Array([1, 2, 3])),
        'ver-2': s3Body(new Uint8Array([4, 5, 6])),
      },
    });
    const { fullMigrate } = await load();
    const redis = fakeRedis();
    const yhub = makeYhub({ redis });

    const result = await fullMigrate(yhub, docRef());

    expect(result).toMatchObject({ status: 'nothing', applied: 0, skipped: 2 });
    expect(yhub.persistence.store).not.toHaveBeenCalled();
    expect(redis.sets.get(MIGRATED_SET)?.has('doc-1')).toBeFalsy();
  });

  it('silently skips a version that vanished between listing and read', async () => {
    const [, v2] = makeVersionChain(['a', 'bc']);
    routeS3({
      list: listNewestFirst([
        { versionId: 'ver-2', ms: 2000 },
        { versionId: 'ver-1', ms: 1000 },
      ]),
      getByVersion: {
        'ver-1': s3NotFound('NoSuchVersion'),
        'ver-2': s3Body(v2),
      },
    });
    const { fullMigrate } = await load();
    const yhub = makeYhub();

    const result = await fullMigrate(yhub, docRef());

    expect(result).toMatchObject({ status: 'ok', applied: 1, skipped: 0 });
  });

  it('follows the version listing across pages', async () => {
    const [v1, v2, v3] = makeVersionChain(['a', 'bc', 'def']);
    const pages = [
      {
        Versions: [
          { Key: 'doc-1/file', VersionId: 'ver-3', LastModified: new Date(3000) },
        ],
        IsTruncated: true,
        NextKeyMarker: 'key-marker',
        NextVersionIdMarker: 'version-marker',
      },
      {
        Versions: [
          { Key: 'doc-1/file', VersionId: 'ver-2', LastModified: new Date(2000) },
          { Key: 'doc-1/file', VersionId: 'ver-1', LastModified: new Date(1000) },
        ],
        IsTruncated: false,
      },
    ];
    let call = 0;
    routeS3({
      list: (input: any) => {
        const page = pages[call++];
        if (call === 2) {
          expect(input.KeyMarker).toBe('key-marker');
          expect(input.VersionIdMarker).toBe('version-marker');
        }
        return page;
      },
      getByVersion: {
        'ver-1': s3Body(v1),
        'ver-2': s3Body(v2),
        'ver-3': s3Body(v3),
      },
    });
    const { fullMigrate } = await load();
    const yhub = makeYhub();

    const result = await fullMigrate(yhub, docRef());

    expect(call).toBe(2);
    expect(result).toMatchObject({ status: 'ok', versions: 3, applied: 3 });
  });

  it('drops the oldest versions past the 500 cap', async () => {
    const update = makeUpdate('constant');
    const entries = Array.from({ length: 501 }, (_, i) => ({
      versionId: `ver-${i}`,
      ms: 1000 + i,
    }));
    routeS3({
      list: listNewestFirst(entries),
      getByVersion: Object.fromEntries(
        entries.map(({ versionId }) => [versionId, s3Body(update)]),
      ),
    });
    const { fullMigrate } = await load();
    const yhub = makeYhub();

    const result = await fullMigrate(yhub, docRef());

    expect(result).toMatchObject({ versions: 500, dropped: 1 });
  });

  it('rejects when the version listing itself fails', async () => {
    routeS3({ list: () => { throw new Error('S3 is down'); } });
    const { fullMigrate } = await load();
    const yhub = makeYhub();

    await expect(fullMigrate(yhub, docRef())).rejects.toThrow('S3 is down');
    const { logger } = await import('@y/hub');
    expect(logger.error).toHaveBeenCalled();
  });
});
