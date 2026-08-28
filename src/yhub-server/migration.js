// Migration off the legacy Django document store (see README.md).
//
// Documents were historically stored by the Django backend in the S3 media
// bucket, as UTF-8 text that is the base64 encoding of a raw Yjs update, at key
// `{document-uuid}/file`. The bucket is versioned, so every snapshot Django
// ever wrote for a document survives as an object version — that is the
// version history the backend exposes at `/documents/{id}/versions/`.
//
// Two paths bring that content into yhub, and they compose:
//
//   maybeMigrate — the lazy seed. On first access to a room yhub does not know,
//     fetch the *newest* version and seed the room with it before admitting the
//     connection. Attributed to `system`, with no timestamp (see below).
//
//   fullMigrate  — the backfill. Replay *every* version into one gc:false
//     document and store the result as a single row at clock 0, so yhub's
//     activity API reports the same timeline as the S3 version listing.
//
// Everything here takes the `yhub` instance explicitly rather than closing over
// it: the endpoint handlers already receive one as `req.yhub`, and the auth
// plugin has the module-level instance by the time it first runs.

import { randomUUID } from 'node:crypto';

import {
  GetObjectCommand,
  ListObjectVersionsCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { logger } from '@y/hub';
import * as Y from '@y/y';

import { secret } from './env.js';

export const SOFT_MIGRATION = process.env.SOFT_MIGRATION === 'true';
// The legacy Django media bucket, the one documents are migrated *out of*. It
// carries a prefix of its own because it is not the only bucket in play: the
// S3 persistence plugin (`YHUB_S3_*`, server.js) persists *into* a bucket that
// may sit on another provider with credentials of its own, and the backend's
// `AWS_S3_*` settings — which a pod may perfectly well carry — name a third.
// Each set is read by exactly the process it belongs to.
const LEGACY_S3_ENDPOINT_URL = process.env.LEGACY_S3_ENDPOINT_URL;
const LEGACY_S3_ACCESS_KEY_ID = secret('LEGACY_S3_ACCESS_KEY_ID');
const LEGACY_S3_SECRET_ACCESS_KEY = secret('LEGACY_S3_SECRET_ACCESS_KEY');
const LEGACY_S3_REGION_NAME = process.env.LEGACY_S3_REGION_NAME;
// Django's default bucket name (impress settings.py) — prod overrides it
const LEGACY_S3_BUCKET_NAME =
  process.env.LEGACY_S3_BUCKET_NAME || 'impress-media-storage';
// How the requests are signed, the counterpart of Django's
// AWS_S3_SIGNATURE_VERSION: a provider that expects the other one answers 403,
// which reads exactly like wrong credentials, so it is worth being explicit
// about. Only SigV4 is offered — see SIGNATURE_VERSIONS below.
const LEGACY_S3_SIGNATURE_VERSION =
  process.env.LEGACY_S3_SIGNATURE_VERSION || 's3v4';
// What that variable accepts, mapped to what it means for the client. The AWS
// SDK v3 signs with SigV4 and dropped SigV2 altogether, so the spellings of
// SigV4 are the whole set: a value asking for SigV2 (`s3`, boto3's other
// choice) is refused at boot rather than silently signed the other way and
// bounced by the provider as a credentials error.
const SIGNATURE_VERSIONS = { s3v4: 'sigv4', v4: 'sigv4' };
const S3_FETCH_TIMEOUT_MS = 10000;
const MIGRATE_LOCK_TTL_MS = 30000;
const MAX_CONCURRENT_SEEDS = 20;
// The full migration replays *every* S3 version of a document, so its budget is
// per-document rather than per-connection — no client is waiting on it.
const S3_LIST_TIMEOUT_MS = 30000;
// A document with more versions than this is migrated from its newest
// MAX_MIGRATE_VERSIONS only: everything older folds into the first replayed
// version, which keeps the run bounded instead of failing it outright. The
// response reports how many were dropped. The replay runs on the main thread,
// so the cap also bounds how long the event loop is blocked.
const MAX_MIGRATE_VERSIONS = 500;
// an empty Yjs update, what patchYdoc diffs the first snapshot against
const EMPTY_YDOC = Y.encodeStateAsUpdate(new Y.Doc());

if (
  SOFT_MIGRATION &&
  (!LEGACY_S3_ENDPOINT_URL ||
    !LEGACY_S3_ACCESS_KEY_ID ||
    !LEGACY_S3_SECRET_ACCESS_KEY)
) {
  // fail at boot instead of as an opaque 401 storm on first connect
  throw new Error(
    'SOFT_MIGRATION=true requires LEGACY_S3_ENDPOINT_URL, LEGACY_S3_ACCESS_KEY_ID and LEGACY_S3_SECRET_ACCESS_KEY',
  );
}
const s3 = SOFT_MIGRATION
  ? (() => {
      const url = new URL(LEGACY_S3_ENDPOINT_URL);
      if (url.pathname !== '/' && url.pathname !== '') {
        // boto3 accepts path-prefixed endpoints but an S3 endpoint cannot
        // carry a base path — dropping it silently would probe the wrong keys
        // and "migrate" every doc as empty
        throw new Error('LEGACY_S3_ENDPOINT_URL must not contain a path');
      }
      const signature =
        SIGNATURE_VERSIONS[LEGACY_S3_SIGNATURE_VERSION.toLowerCase()];
      if (signature == null) {
        throw new Error(
          `LEGACY_S3_SIGNATURE_VERSION must be one of ${Object.keys(
            SIGNATURE_VERSIONS,
          ).join(', ')} (got "${LEGACY_S3_SIGNATURE_VERSION}")`,
        );
      }
      return new S3Client({
        endpoint: url.origin,
        // required by the sdk even where the provider ignores it; us-east-1 is
        // what every S3-compatible implementation answers to by default
        region: LEGACY_S3_REGION_NAME || 'us-east-1',
        credentials: {
          accessKeyId: LEGACY_S3_ACCESS_KEY_ID,
          secretAccessKey: LEGACY_S3_SECRET_ACCESS_KEY,
        },
        // `sigv4` today, and the client is built from the setting rather than
        // from the default so that the value is what decides
        authSchemePreference: [`aws.auth#${signature}`],
        // Virtual-host style addresses a bucket as `{bucket}.{host}`, which
        // needs a DNS record self-hosted providers do not have. AWS is the one
        // endpoint that prefers it — and the one deprecating path style.
        forcePathStyle: !/(^|\.)amazonaws\.com$/i.test(url.hostname),
      });
    })()
  : null;
// exported so the auth path can report, under the same module name, that it
// admitted a caller to a document it could not migrate
export const migrationLog = logger.child({ module: 'soft-migration' });

// Both keys are derived from the prefix yhub itself resolved, so they cannot
// drift from the room keys, and both sit outside its scanned `:room:*` pattern.
//
// One seeder per room:
const migrateLockKey = (yhub, docRef) =>
  `${yhub.stream.prefix}:softmigrate:${docRef.org}:${docRef.docid}:${docRef.branch}`;
// Documents whose version history has been replayed into postgres. Membership
// is permanent: a second replay of the same versions would attribute the same
// content twice (see fullMigrate).
const migratedSetKey = (yhub) => `${yhub.stream.prefix}:migrated:v1`;

// An aborted request surfaces as whatever the sdk or the body stream raises
// when the socket goes away ("aborted", TimeoutError, …). Say what actually
// happened instead, and leave it unmarked so it stays retryable — a slow S3
// may well recover.
const asTimeout = (err, signal, what, ms) =>
  signal.aborted ? new Error(`${what} timed out after ${ms}ms`) : err;

// Legacy Django document store: object `{docid}/file`, body = UTF-8 text that
// is the base64 encoding of a raw Yjs update. With `versionId`, reads that
// specific object version instead of the current one. Returns null when the
// object (or version) does not exist — a document that never had content
// saved, e.g. brand new. Throws on any other failure (network, auth, timeout);
// corrupt base64 decodes leniently to garbage that the callers reject.
const fetchLegacyDoc = async (docid, versionId = null) => {
  // One budget for the whole read, headers and body alike: the sdk aborts the
  // request when it fires and the body stream dies with it, so a stalled
  // transfer cannot hold the ws upgrade open.
  const abortSignal = AbortSignal.timeout(S3_FETCH_TIMEOUT_MS);
  let body;
  try {
    ({ Body: body } = await s3.send(
      new GetObjectCommand({
        Bucket: LEGACY_S3_BUCKET_NAME,
        Key: `${docid}/file`,
        ...(versionId != null ? { VersionId: versionId } : {}),
      }),
      { abortSignal },
    ));
  } catch (err) {
    // NoSuchVersion: the version vanished between listing and reading.
    // NotFound is the bare 404 some S3-compatible providers answer with
    // instead; a missing *bucket* has a name of its own and is not caught
    // here — that one is a misconfiguration, not an absent document.
    if (
      err?.name === 'NoSuchKey' ||
      err?.name === 'NoSuchVersion' ||
      err?.name === 'NotFound'
    ) {
      return null;
    }
    throw asTimeout(err, abortSignal, 's3 fetch', S3_FETCH_TIMEOUT_MS);
  }
  let encoded;
  try {
    // the object whole, whatever its size: it is one document's content, and
    // refusing to read it is refusing to migrate that document at all
    encoded = await body.transformToString('utf8');
  } catch (err) {
    throw asTimeout(err, abortSignal, 's3 fetch', S3_FETCH_TIMEOUT_MS);
  }
  const decoded = Buffer.from(encoded, 'base64');
  // compute-task schema requires an exact Uint8Array (lib0 compares the
  // constructor) — re-view the Buffer without copying
  return new Uint8Array(decoded.buffer, decoded.byteOffset, decoded.byteLength);
};

// Every version of the legacy object, oldest first. Delete markers are skipped
// (they record a deletion and carry no body), and so are keys that merely share
// the prefix — S3 has no exact-key version listing.
const listLegacyVersions = async (docid) => {
  const key = `${docid}/file`;
  // one budget for the whole listing, however many pages it takes
  const abortSignal = AbortSignal.timeout(S3_LIST_TIMEOUT_MS);
  const found = [];
  try {
    let keyMarker;
    let versionIdMarker;
    let truncated = true;
    while (truncated) {
      const page = await s3.send(
        new ListObjectVersionsCommand({
          Bucket: LEGACY_S3_BUCKET_NAME,
          Prefix: key,
          KeyMarker: keyMarker,
          VersionIdMarker: versionIdMarker,
        }),
        { abortSignal },
      );
      // delete markers record a deletion and carry no body; they come in a
      // list of their own here, so reading `Versions` skips them by itself
      for (const version of page.Versions ?? []) {
        if (version.Key === key && version.VersionId) {
          found.push({
            versionId: String(version.VersionId),
            // the moment S3 accepted the write: what the backend's version
            // listing reports as `last_modified`, and what we attribute to
            timestamp: version.LastModified?.getTime() ?? 0,
          });
        }
      }
      truncated = page.IsTruncated === true;
      keyMarker = page.NextKeyMarker;
      versionIdMarker = page.NextVersionIdMarker;
    }
  } catch (err) {
    const failure = asTimeout(
      err,
      abortSignal,
      's3 version listing',
      S3_LIST_TIMEOUT_MS,
    );
    migrationLog.error(
      {
        event: 'list_version.failed',
        err: failure,
        docid,
        bucket: LEGACY_S3_BUCKET_NAME,
        key,
      },
      'impossible to list object version',
    );
    throw failure;
  }
  // S3 lists a key's versions newest first; reverse to replay them in write
  // order. The sort is a stable safeguard across paginated listings — equal
  // timestamps keep S3's own ordering.
  found.reverse();
  found.sort((a, b) => a.timestamp - b.timestamp);
  const dropped = Math.max(0, found.length - MAX_MIGRATE_VERSIONS);
  return { versions: found.slice(dropped), dropped };
};

// Quick existence check: does yhub already have content for this room?
// Sequenced cheapest-first: a persisted postgres row (bare SELECT, no blob
// columns; rows are never deleted, so a hit is always safe) — then the valkey
// stream (only ydoc:update:v1 counts: awareness and auth-check messages share
// the stream but carry no content) — then the SELECT again, which closes the
// store-before-trim compaction race (and the worst case of a miss is only a
// redundant, idempotent re-seed).
const ydocExists = async (yhub, docRef) => {
  if ((await yhub.persistence.retrieveDoc(docRef, {})).lastClock !== '0') {
    return true;
  }
  const streams = await yhub.stream.getMessages([{ docRef, clock: '0' }]);
  if ((streams[0]?.messages ?? []).some((m) => m.type === 'ydoc:update:v1')) {
    return true;
  }
  return (await yhub.persistence.retrieveDoc(docRef, {})).lastClock !== '0';
};

// Per-docid migration verdicts, in-memory (per replica). 'exists' is monotone
// in normal operation — its TTL only bounds staleness after an operator
// manually wipes a room's yhub state (restart yhub after a wipe to drop the
// cache immediately). 'empty' (no S3 object) keeps never-edited docs and
// rechecks off S3; 'failed' breaks the retry-refetch storm a permanently
// corrupt object would otherwise sustain (y-websocket retries denied upgrades
// forever).
const VERDICT_TTL_MS = { exists: 600000, empty: 60000, failed: 300000 };
// transient failures (network blips, timeouts, S3 restarting) are cached just
// long enough to blunt a retry storm without turning a hiccup into a lockout
const TRANSIENT_TTL_MS = 15000;
// Is this legacy object beyond saving, as opposed to merely out of reach right
// now? Only a failure raised while *interpreting* bytes we already hold
// qualifies: the object does not decode, or it is larger than we will load.
// Those are marked at the throw site, and nothing else counts — an allowlist
// of retryable errors would have to enumerate every way S3 can say no
// (AccessDenied on a rotated key, NoSuchBucket on a misconfigured name, a
// region redirect), and each one it missed would be read as "this document has
// no content" and open the room empty over content that is alive in S3.
// Guessing wrong in this direction costs a retry; guessing wrong in the other
// costs the document.
export const isPermanentFailure = (err) => err?.permanent === true;
const VERDICT_CACHE_MAX = 50000;
const verdicts = new Map(); // docid -> { verdict, error, expires }
const rememberVerdict = (
  docid,
  verdict,
  error = null,
  ttl = VERDICT_TTL_MS[verdict],
) => {
  // delete-then-set keeps Map insertion order ≈ recency, so the FIFO eviction
  // drops the stalest entry — and re-setting an existing docid never evicts
  // an unrelated one
  if (!verdicts.delete(docid) && verdicts.size >= VERDICT_CACHE_MAX) {
    verdicts.delete(verdicts.keys().next().value);
  }
  verdicts.set(docid, {
    verdict,
    error,
    expires: Date.now() + ttl,
  });
};
const inflightMigrations = new Map(); // docid -> Promise<void>
let activeSeeds = 0;

const migrate = async (yhub, docRef) => {
  // A fully migrated room holds a single row at clock 0, which leaves
  // `lastClock` at '0' — so ydocExists cannot see it and would seed on top of a
  // complete history. Harmless (the seed's attributions are excluded as already
  // known) but a pointless S3 round-trip per document during a backfill.
  if (await yhub.stream.redis.sIsMember(migratedSetKey(yhub), docRef.docid)) {
    return 'exists';
  }
  if (await ydocExists(yhub, docRef)) return 'exists';
  // collapse cross-replica herds: one seeder per room, the rest wait and
  // re-probe
  const lockKey = migrateLockKey(yhub, docRef);
  const lockToken = randomUUID();
  const redis = yhub.stream.redis;
  const acquired = await redis.set(lockKey, lockToken, {
    condition: 'NX',
    expiration: { type: 'PX', value: MIGRATE_LOCK_TTL_MS },
  });
  try {
    if (acquired == null) {
      // another connection or replica is seeding — wait for its lock, then
      // re-probe. If the doc is still absent (the holder crashed or its S3
      // fetch failed), fall through and seed ourselves: duplicate seeds use
      // byte-identical updates from one lineage and merge as CRDT no-ops.
      const deadline = Date.now() + MIGRATE_LOCK_TTL_MS + 5000;
      while (Date.now() < deadline && (await redis.exists(lockKey)) === 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      if (await ydocExists(yhub, docRef)) return 'exists';
    }
    if (activeSeeds >= MAX_CONCURRENT_SEEDS) {
      // fail fast under a herd of distinct cold docs — the client's retry
      // backoff spreads the load. Probes above stay uncapped. noCache:
      // momentary per-replica backpressure must deny once, not be cached as
      // a failure — a slot frees up within seconds
      const err = new Error('too many concurrent soft migrations');
      err.noCache = true;
      throw err;
    }
    activeSeeds++;
    try {
      const start = Date.now();
      const update = await fetchLegacyDoc(docRef.docid);
      if (update == null) {
        migrationLog.info(
          { event: 'seed.empty', docid: docRef.docid },
          'no legacy s3 object; room starts empty',
        );
        return 'empty';
      }
      // Decode before writing anything: a legacy object that is not a valid
      // Yjs update fails here, on this thread, and is the one failure we know
      // no retry can fix — so it is marked as such.
      let contentids;
      try {
        contentids = Y.createContentIdsFromUpdate(update);
      } catch (err) {
        err.permanent = true;
        throw err;
      }
      await yhub.stream.addMessage(docRef, {
        type: 'ydoc:update:v1',
        // Deliberately no insertAt/deleteAt. A lazy seed is not an editing
        // event: stamping it would put a second, meaningless timestamp on
        // content that the full migration attributes to its real S3 version
        // time — and persisted contentmaps are merged, not de-duplicated, so
        // both would survive on the same ids and the activity API would report
        // whichever the row order happened to put last. Content seeded this way
        // carries an author but no timestamp, so it produces no activity entry
        // until fullMigrate supplies the history.
        contentmap: Y.encodeContentMap(
          Y.createContentMapFromContentIds(
            contentids,
            [
              Y.createContentAttribute('insert', 'system'),
              Y.createContentAttribute('insert:migration', 's3'),
            ],
            [
              Y.createContentAttribute('delete', 'system'),
              Y.createContentAttribute('delete:migration', 's3'),
            ],
          ),
        ),
        update,
      });
      migrationLog.info(
        {
          event: 'seed.ok',
          docid: docRef.docid,
          bytes: update.byteLength,
          durationMs: Date.now() - start,
        },
        'seeded legacy doc from s3',
      );
      return 'exists';
    } finally {
      activeSeeds--;
    }
  } finally {
    if (acquired != null) {
      // compare-and-delete: if this seed outlived the lock TTL, another
      // seeder holds a fresh lock — a bare DEL would release it under them
      redis
        .eval(
          "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) end",
          { keys: [lockKey], arguments: [lockToken] },
        )
        .catch(() => {});
    }
  }
};

// Resolves when the room is usable (already known, freshly seeded, or
// legitimately empty); rejects to deny access. Idempotent and safe to
// re-enter — it also runs on rechecks and default-purpose REST calls.
export const maybeMigrate = async (yhub, docRef) => {
  const cached = verdicts.get(docRef.docid);
  if (cached != null && cached.expires > Date.now()) {
    if (cached.verdict === 'failed') throw cached.error;
    return;
  }
  let migration = inflightMigrations.get(docRef.docid);
  if (migration == null) {
    migration = migrate(yhub, docRef)
      .then(
        (verdict) => rememberVerdict(docRef.docid, verdict),
        (err) => {
          // The one place the *cause* is recorded, once per attempt rather
          // than per access: a cached verdict re-raises this error without
          // logging again until it expires.
          const permanent = isPermanentFailure(err);
          migrationLog.error(
            {
              event: 'seed.failed',
              err,
              docid: docRef.docid,
              permanent,
              bucket: LEGACY_S3_BUCKET_NAME,
              key: `${docRef.docid}/file`,
            },
            permanent
              ? 'soft migration is not possible for this legacy object'
              : 'soft migration failed; the caller is asked to retry',
          );
          if (err?.noCache !== true) {
            // a retryable failure is remembered only briefly, so a hiccup
            // cannot lock a document out for the full poison-object window
            rememberVerdict(
              docRef.docid,
              'failed',
              err,
              permanent ? VERDICT_TTL_MS.failed : TRANSIENT_TTL_MS,
            );
          }
          throw err;
        },
      )
      .finally(() => inflightMigrations.delete(docRef.docid));
    inflightMigrations.set(docRef.docid, migration);
  }
  return migration;
};

// Add the legacy version history to the room. Returns a `status` the endpoint
// maps to a response:
//   'already' — already replayed for this docid; the room is left untouched
//   'empty'   — no legacy object in S3; the room is left untouched
//   'nothing' — versions exist but none is readable; the room is left untouched
//   'ok'      — history stored
//
// Additive, never destructive: the versions are replayed into one gc:false
// document, and the result lands as a *single new row* at clock 0 — nothing
// existing is deleted and nothing goes on the stream. Clock 0 is what makes
// that safe. `store` is ON CONFLICT DO NOTHING on (org, docid, branch, t), so a
// concurrent or repeated call is a database no-op; `retrieveDoc` derives
// `lastClock` from the *newest* row, so a 0 row can never hide the stream
// messages a live editor is writing; and the history is genuinely the oldest
// thing in the room. The next compact task merges the row into the room's
// normal state and drops it — yhub needs no special case for any of this.
export const fullMigrate = async (yhub, docRef, { force = false } = {}) => {
  const start = Date.now();
  const redis = yhub.stream.redis;
  // Membership is the guard against attributing the same content twice: once
  // compaction has folded the clock-0 row into a normal one and deleted it,
  // a second replay would insert a second contentmap for ids that already
  // carry one, and the two timestamps would both survive the merge.
  if (!force && (await redis.sIsMember(migratedSetKey(yhub), docRef.docid))) {
    return { status: 'already' };
  }
  const { versions, dropped } = await listLegacyVersions(docRef.docid);
  if (versions.length === 0) {
    return { status: 'empty', versions: 0, durationMs: Date.now() - start };
  }
  // Replay every snapshot into one gc:false document. gc matters: a collected
  // doc would lose the content later versions deleted, which is most of what
  // makes a history worth having.
  const ydoc = new Y.Doc({ gc: false });
  // ids already attributed, so each version is credited only with what it added
  let seen = Y.createContentIds();
  const contentmaps = [];
  let bytes = 0;
  let skipped = 0;
  try {
    for (const version of versions) {
      const update = await fetchLegacyDoc(docRef.docid, version.versionId);
      if (update == null) continue; // deleted between listing and read
      bytes += update.byteLength;
      try {
        // Decode before applying. applyUpdate throwing part-way through would
        // leave the accumulating doc in an undefined state, and this is the
        // same lazy structural scan it would fail on.
        Y.createContentIdsFromUpdate(update);
      } catch (err) {
        // Skip an unreadable snapshot rather than failing the document: every
        // later version is a full snapshot, so its content still arrives — only
        // this timeline entry is lost, and a corrupt version has nothing else
        // to give.
        skipped++;
        migrationLog.warn(
          {
            event: 'full.version-skipped',
            err,
            docid: docRef.docid,
            versionId: version.versionId,
          },
          'legacy s3 version is not a valid yjs update; skipping it',
        );
        continue;
      }
      Y.applyUpdate(ydoc, update);
      // `true`: inserts include content the doc has already deleted, so this is
      // the full structural snapshot rather than what is currently visible
      const all = Y.createContentIdsFromDoc(ydoc, true);
      const fresh = Y.excludeContentIds(all, seen);
      seen = all;
      if (
        fresh.inserts.clients.size === 0 &&
        fresh.deletes.clients.size === 0
      ) {
        continue; // this snapshot added nothing new
      }
      // Legacy snapshots carry no author, so every version is attributed to the
      // 'system' identity (as the lazy seed is). The timestamp is what makes an
      // entry identifiable: it is the version's S3 `LastModified`, so activity
      // entries line up with the backend's version listing by time.
      const attrs = (verb) => [
        Y.createContentAttribute(verb, 'system'),
        Y.createContentAttribute(`${verb}At`, version.timestamp),
      ];
      contentmaps.push(
        Y.createContentMapFromContentIds(
          fresh,
          attrs('insert'),
          attrs('delete'),
        ),
      );
    }
    if (contentmaps.length === 0) {
      // every version was unreadable or contentless — nothing to store, and
      // nothing to remember either, so a later run can still pick it up
      return {
        status: 'nothing',
        versions: versions.length,
        applied: 0,
        skipped,
        dropped,
        bytes,
        durationMs: Date.now() - start,
      };
    }
    const nongcDoc = Y.encodeStateAsUpdate(ydoc);
    await yhub.persistence.store(docRef, {
      lastClock: '0',
      gcDoc: await yhub.computePool.mergeUpdates(true, [nongcDoc], { docRef }),
      nongcDoc,
      contentmap: Y.encodeContentMap(Y.mergeContentMaps(contentmaps)),
      contentids: Y.encodeContentIds(seen),
    });
  } finally {
    ydoc.destroy();
  }
  await redis.sAdd(migratedSetKey(yhub), docRef.docid);
  const result = {
    status: 'ok',
    versions: versions.length,
    applied: contentmaps.length,
    skipped,
    dropped,
    bytes,
    durationMs: Date.now() - start,
  };
  migrationLog.info(
    { event: 'full.ok', docid: docRef.docid, ...result },
    'stored document history from s3 versions',
  );
  return result;
};
