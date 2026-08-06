import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { createApiEndpoint, createAuthPlugin, createYHub, logger } from '@y/hub';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { Client as S3Client } from 'minio';

// mirror y-provider's env.ts secret-file support
const secret = (name, dflt) =>
  process.env[`${name}_FILE`]
    ? readFileSync(process.env[`${name}_FILE`], 'utf8').trim()
    : process.env[name] || dflt;

const PORT = Number(process.env.PORT || 3002);
const REDIS = process.env.REDIS;
const POSTGRES = process.env.POSTGRES;
const REDIS_PREFIX = process.env.REDIS_PREFIX || 'yhub';
const COLLABORATION_BACKEND_BASE_URL =
  process.env.COLLABORATION_BACKEND_BASE_URL || 'http://app-dev:8000';
const allowedOrigins = (
  process.env.COLLABORATION_SERVER_ORIGIN || 'http://localhost:3000'
).split(',');
const Y_PROVIDER_API_KEY = secret('Y_PROVIDER_API_KEY', 'yprovider-api-key');
const ORG = process.env.YHUB_ORG || 'docs';
// Requiring this audience stops a valid admin JWT that Django issued for
// another service (today: the y-converter token in converter_services.py,
// which is handed to the converter process) from being replayed against yhub.
// Hardcoded, like y-provider's Y_CONVERTER_AUDIENCE: both ends of a two-party
// contract, so an env var would only add a way to misconfigure it into a 401.
const YHUB_AUDIENCE = 'yhub';
// lowercase only (no /i): Django serializes UUIDs lowercase, while yhub rooms
// and S3 keys are case-sensitive strings — accepting case variants would let a
// client open a parallel room for the same document (and, with soft migration,
// miss its S3 object and fork the document's lineage)
const UUID4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
// an empty Yjs update (what `Y.encodeStateAsUpdate(new Y.Doc())` encodes to) —
// hardcoded so we don't import @y/y for two bytes
const EMPTY_YDOC = new Uint8Array([0, 0]);
// uws buffers the whole body before the handler sees it, so this cap does not
// bound upload memory — it bounds what a single create hands to a compute
// worker and writes to the valkey stream as one message. Creates carry one
// freshly-converted snapshot (typically KBs); anything bigger belongs on the
// websocket path.
const MAX_CREATE_BYTES = 10 * 1024 * 1024;

// Soft migration (see README.md): legacy documents live in Django's S3 media
// bucket as UTF-8 base64 of a raw Yjs update at key `{docid}/file`. With
// SOFT_MIGRATION=true, the first access to a room yhub does not know yet
// fetches that object, seeds the room with it (attributed to 'system'), and
// only then admits the connection.
const SOFT_MIGRATION = process.env.SOFT_MIGRATION === 'true';
const AWS_S3_ENDPOINT_URL = process.env.AWS_S3_ENDPOINT_URL;
const AWS_S3_ACCESS_KEY_ID = secret('AWS_S3_ACCESS_KEY_ID');
const AWS_S3_SECRET_ACCESS_KEY = secret('AWS_S3_SECRET_ACCESS_KEY');
const AWS_S3_REGION_NAME = process.env.AWS_S3_REGION_NAME;
// Django's default bucket name (impress settings.py) — prod overrides it
const AWS_STORAGE_BUCKET_NAME =
  process.env.AWS_STORAGE_BUCKET_NAME || 'impress-media-storage';
// base64 inflates 3 bytes to 4 — cap the streamed read at the encoded size of
// MAX_CREATE_BYTES (the same effective limit as create-ydoc) plus padding slack
const MAX_LEGACY_B64_BYTES = Math.ceil(MAX_CREATE_BYTES / 3) * 4 + 1024;
const S3_FETCH_TIMEOUT_MS = 10000;
const MIGRATE_LOCK_TTL_MS = 30000;
const MAX_CONCURRENT_SEEDS = 4;

if (
  SOFT_MIGRATION &&
  (!AWS_S3_ENDPOINT_URL || !AWS_S3_ACCESS_KEY_ID || !AWS_S3_SECRET_ACCESS_KEY)
) {
  // fail at boot instead of as an opaque 401 storm on first connect
  throw new Error(
    'SOFT_MIGRATION=true requires AWS_S3_ENDPOINT_URL, AWS_S3_ACCESS_KEY_ID and AWS_S3_SECRET_ACCESS_KEY',
  );
}
const s3 = SOFT_MIGRATION
  ? (() => {
      const url = new URL(AWS_S3_ENDPOINT_URL);
      if (url.pathname !== '/' && url.pathname !== '') {
        // boto3 accepts path-prefixed endpoints but the minio client cannot
        // address a base path — dropping it silently would probe the wrong
        // keys and "migrate" every doc as empty
        throw new Error('AWS_S3_ENDPOINT_URL must not contain a path');
      }
      return new S3Client({
        endPoint: url.hostname,
        port:
          url.port !== ''
            ? Number(url.port)
            : url.protocol === 'https:'
              ? 443
              : 80,
        useSSL: url.protocol === 'https:',
        accessKey: AWS_S3_ACCESS_KEY_ID,
        secretKey: AWS_S3_SECRET_ACCESS_KEY,
        ...(AWS_S3_REGION_NAME ? { region: AWS_S3_REGION_NAME } : {}),
      });
    })()
  : null;
const migrationLog = logger.child({ module: 'soft-migration' });

// Public keys verifying the RS256 admin tokens Django issues (JWTService).
// Lazily fetched on first use; jose caches the keys and refetches on unknown
// "kid", so Django can rotate the signing key without a yhub restart.
const JWKS = createRemoteJWKSet(
  new URL(`${COLLABORATION_BACKEND_BASE_URL}/api/v1.0/jwks`),
);

const backendFetch = async (path, { cookie, origin }) => {
  const res = await fetch(`${COLLABORATION_BACKEND_BASE_URL}${path}`, {
    headers: {
      cookie,
      origin,
      'X-Y-Provider-Key': Y_PROVIDER_API_KEY,
    },
  });
  if (!res.ok) {
    const err = new Error(`Failed to fetch ${path}: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
};

// Legacy Django document store: object `{docid}/file`, body = UTF-8 text that
// is the base64 encoding of a raw Yjs update. Returns null when the object
// does not exist — a document that never had content saved, e.g. brand new.
// Throws on any other failure (network, auth, timeout, oversize); corrupt
// base64 decodes leniently to garbage that patchYdoc later rejects.
const fetchLegacyDoc = async (docid) => {
  let stream = null;
  let cancelTimeout = () => {};
  // minio 8 takes no AbortSignal — race a timer that also destroys the body
  // stream once reading, so a stalled transfer cannot hold the ws upgrade
  const timeout = new Promise((_, reject) => {
    const timer = setTimeout(() => {
      const err = new Error(
        `s3 fetch timed out after ${S3_FETCH_TIMEOUT_MS}ms`,
      );
      err.transient = true; // a slow S3 may recover — cache the failure briefly
      stream?.destroy(err);
      reject(err);
    }, S3_FETCH_TIMEOUT_MS);
    cancelTimeout = () => clearTimeout(timer);
  });
  try {
    let objPromise;
    try {
      objPromise = s3.getObject(AWS_STORAGE_BUCKET_NAME, `${docid}/file`);
      stream = await Promise.race([objPromise, timeout]);
    } catch (err) {
      if (err?.code === 'NoSuchKey') return null;
      // if the timeout won the race, getObject may still resolve later —
      // destroy the late-arriving response stream, otherwise its never-read
      // socket leaks (minio 8 sets no request timeout and cannot abort)
      objPromise?.then((s) => s.destroy(err), () => {});
      throw err;
    }
    const body = await Promise.race([
      new Promise((resolve, reject) => {
        const chunks = [];
        let received = 0;
        stream.on('data', (chunk) => {
          received += chunk.byteLength;
          if (received > MAX_LEGACY_B64_BYTES) {
            stream.destroy(
              new Error(`legacy object exceeds the ${MAX_LEGACY_B64_BYTES}B cap`),
            );
            return;
          }
          chunks.push(chunk);
        });
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
      }),
      timeout,
    ]);
    const decoded = Buffer.from(body.toString('utf8'), 'base64');
    if (decoded.byteLength > MAX_CREATE_BYTES) {
      throw new Error(
        `decoded legacy update (${decoded.byteLength}B) exceeds the ${MAX_CREATE_BYTES}B cap`,
      );
    }
    // compute-task schema requires an exact Uint8Array (lib0 compares the
    // constructor) — re-view the Buffer without copying
    return new Uint8Array(
      decoded.buffer,
      decoded.byteOffset,
      decoded.byteLength,
    );
  } finally {
    cancelTimeout();
  }
};

// Quick existence check: does yhub already have content for this room?
// Sequenced cheapest-first: a persisted postgres row (bare SELECT, no blob
// columns; rows are never deleted, so a hit is always safe) — then the valkey
// stream (only ydoc:update:v1 counts: awareness and auth-check messages share
// the stream but carry no content) — then the SELECT again, which closes the
// store-before-trim compaction race (and the worst case of a miss is only a
// redundant, idempotent re-seed).
const ydocExists = async (room) => {
  if ((await yhub.persistence.retrieveDoc(room, {})).lastClock !== '0') {
    return true;
  }
  const streams = await yhub.stream.getMessages([{ room, clock: '0' }]);
  if ((streams[0]?.messages ?? []).some((m) => m.type === 'ydoc:update:v1')) {
    return true;
  }
  return (await yhub.persistence.retrieveDoc(room, {})).lastClock !== '0';
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
const TRANSIENT_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
]);
const isTransient = (err) =>
  err?.transient === true ||
  TRANSIENT_CODES.has(err?.code) ||
  TRANSIENT_CODES.has(err?.cause?.code);
const VERDICT_CACHE_MAX = 50000;
const verdicts = new Map(); // docid -> { verdict, error, expires }
const rememberVerdict = (docid, verdict, error = null, ttl = VERDICT_TTL_MS[verdict]) => {
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

const migrate = async (room) => {
  if (await ydocExists(room)) return 'exists';
  // collapse cross-replica herds: one seeder per room, the rest wait and
  // re-probe. The key sits outside yhub's scanned `:room:*` patterns.
  const lockKey = `${REDIS_PREFIX}:softmigrate:${room.org}:${room.docid}:${room.branch}`;
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
      if (await ydocExists(room)) return 'exists';
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
      const update = await fetchLegacyDoc(room.docid);
      if (update == null) {
        migrationLog.info(
          { event: 'seed.empty', docid: room.docid },
          'no legacy s3 object; room starts empty',
        );
        return 'empty';
      }
      // legacy content has no per-user history — attribute it to 'system'
      // (the admin-JWT identity), marked so audits can tell migrated content
      // apart from other system writes
      const result = await yhub.computePool.patchYdoc(
        {
          update,
          currentDoc: EMPTY_YDOC,
          userid: 'system',
          customAttributions: [{ k: 'migration', v: 's3' }],
        },
        { room },
      );
      if (result == null) {
        // structurally valid but no effective content — nothing to seed
        migrationLog.info(
          { event: 'seed.empty', docid: room.docid },
          'legacy s3 object has no effective content; room starts empty',
        );
        return 'empty';
      }
      await yhub.stream.addMessage(room, {
        type: 'ydoc:update:v1',
        contentmap: result.contentmap,
        update: result.update,
      });
      migrationLog.info(
        {
          event: 'seed.ok',
          docid: room.docid,
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
const maybeMigrate = async (room) => {
  const cached = verdicts.get(room.docid);
  if (cached != null && cached.expires > Date.now()) {
    if (cached.verdict === 'failed') throw cached.error;
    return;
  }
  let migration = inflightMigrations.get(room.docid);
  if (migration == null) {
    migration = migrate(room)
      .then(
        (verdict) => rememberVerdict(room.docid, verdict),
        (err) => {
          // logged here (once per attempt) rather than per denied connection:
          // cached failures deny without new logs until the verdict expires
          migrationLog.error(
            { event: 'seed.failed', err, docid: room.docid },
            'soft migration failed; denying access',
          );
          if (err?.noCache !== true) {
            // transient failures get a short TTL so a hiccup cannot lock a
            // doc out for the full poison-object window
            rememberVerdict(
              room.docid,
              'failed',
              err,
              isTransient(err) ? TRANSIENT_TTL_MS : VERDICT_TTL_MS.failed,
            );
          }
          throw err;
        },
      )
      .finally(() => inflightMigrations.delete(room.docid));
    inflightMigrations.set(room.docid, migration);
  }
  return migration;
};

const auth = createAuthPlugin({
  // uws req is only valid synchronously — read headers AND query before first await.
  async readAuthInfo(req) {
    const authorization = req.getHeader('authorization');
    const cookie = req.getHeader('cookie');
    const origin = req.getHeader('origin');
    const gcOff = req.getQuery('gc') === 'false';
    if (authorization !== '') {
      // backend-to-server call: RS256 JWT signed by Django, verified against
      // its JWKS. A browser cannot attach an Authorization header to a ws
      // upgrade or a credentialed cross-origin fetch, so this never shadows a
      // real user session. present-but-invalid fails here (401) instead of
      // falling through to the cookie flow, which would mask a
      // misconfiguration as an origin error.
      const token = authorization.startsWith('Bearer ')
        ? authorization.slice('Bearer '.length)
        : authorization;
      try {
        // clockTolerance absorbs Django's cache-at-exp race (the admin token
        // is cached for exactly its lifetime, so it can arrive here moments
        // after exp) plus small clock skew — without it a kick would be
        // silently dropped as a 401.
        const { payload } = await jwtVerify(token, JWKS, {
          algorithms: ['RS256'],
          audience: YHUB_AUDIENCE,
          clockTolerance: 5,
        });
        // admin tokens act as the "system" user (no per-user admin identities yet)
        return payload.admin === true
          ? { userid: 'system', admin: true }
          : null;
      } catch {
        // bad signature / expired / wrong (or missing) audience / JWKS
        // unreachable — fail closed
        return null;
      }
    }
    if (gcOff) return null; // full-history connections: not for Docs users
    if (!origin || !allowedOrigins.includes(origin)) return null; // was 4001 'Origin not allowed'
    if (!cookie) return null; // was 4001 'No cookies'
    try {
      const user = await backendFetch('/api/v1.0/users/me/', {
        cookie,
        origin,
      });
      return { userid: String(user.id), cookie, origin }; // MUST be string (yhub server.js:667)
    } catch (err) {
      // Only a genuine "not signed in" falls back to the anonymous identity.
      // On backend failure (5xx/network) fail closed: a signed-in editor
      // authorized under an anon userid would be invisible to the targeted
      // reset-connections recheck (users: [<uuid>]) for the connection's
      // whole lifetime.
      if (err?.status !== 401 && err?.status !== 403) return null;
      // anonymous (public docs): stable per-session id — random ids would mint a new
      // permanent attribution identity per reconnect
      const anon = createHash('sha256')
        .update(cookie)
        .digest('base64url')
        .slice(0, 16);
      return { userid: `anon:${anon}`, cookie, origin };
    }
  },
  async getAccessType(authInfo, { org, docid, branch }, purpose) {
    if (authInfo.admin === true) return 'rw'; // Django's admin token: full access
    // Regular users only get access for the default purpose — custom-endpoint
    // purposes (reset-connections) are backend-internal. Loose != on purpose:
    // ws upgrades and rechecks pass undefined, built-in rest endpoints null.
    if (
      org !== ORG ||
      branch !== 'main' ||
      !UUID4.test(docid) ||
      purpose != null
    ) {
      return null;
    }
    let doc;
    try {
      doc = await backendFetch(`/api/v1.0/documents/${docid}/`, authInfo);
    } catch {
      return null;
    }
    if (!doc.abilities?.retrieve) {
      return null;
    }
    if (SOFT_MIGRATION) {
      // First access to a room yhub does not know: seed it from the legacy
      // Django S3 store before admitting the connection. Awaited inside the
      // upgrade handler, so the post-upgrade initial sync (which merges
      // postgres and the stream from clock 0) is guaranteed to include the
      // seed. Runs only for authorized readers. A missing S3 object is the
      // brand-new-document case and allows an empty room; a real S3/compute
      // failure denies access — an opaque 401 the client retries with
      // backoff.
      try {
        await maybeMigrate({ org, docid, branch });
      } catch {
        return null; // already logged (once per attempt) in maybeMigrate
      }
    }
    return doc.abilities.update ? 'rw' : 'r';
  },
});

// Mimic the old y-provider REST responses (JSON, not yhub's lib0-any
// encoding) so the Django caller keeps its historical contract.
const jsonResponse = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const api = [
  // POST /collaboration/reset-connections/v1/{org}/{docid} — replaces
  // y-provider's /collaboration/api/reset-connections/?room=. Doc-scoped, so
  // the room comes from the path; access is gated to the admin token via the
  // 'reset-connections' purpose in getAccessType. uws routes are exact: a
  // trailing slash 404s.
  createApiEndpoint('reset-connections', {
    accessPurpose: 'reset-connections',
    post: {
      handler: async (req) => {
        const userId = req.headers['x-user-id'] || null;
        if (req.org !== ORG) {
          return jsonResponse(400, { error: 'Unknown org' });
        }
        if (!UUID4.test(req.docid)) {
          return jsonResponse(400, { error: 'Room name is invalid' });
        }
        // in-place recheck: every yhub server re-runs getAccessType per
        // matching connection and closes 4401 only when the access changed —
        // no reconnect churn for unaffected clients
        await req.yhub.recheckAuth(req.room, {
          users: userId ? [userId] : null,
        });
        return jsonResponse(200, { message: 'Connections reset' });
      },
    },
  }),
  // POST /collaboration/create-ydoc/v1/{org}/{docid} — create a document's
  // initial Yjs state from a RAW binary update (`Y.encodeStateAsUpdate` /
  // pycrdt `get_update()` output) posted as application/octet-stream. Unlike
  // yhub's built-in `PATCH ydoc`, the body is not lib0-any encoded, so Django
  // can call it with a plain `requests.post(url, data=raw_bytes)`. Strict
  // create: 409 when the room already has content. Default access purpose:
  // guarded like the built-in ydoc routes (write access on the doc — the
  // admin JWT, or a user session with update ability).
  createApiEndpoint('create-ydoc', {
    post: {
      handler: async (req) => {
        if (req.org !== ORG) {
          return jsonResponse(400, { error: 'Unknown org' });
        }
        if (!UUID4.test(req.docid)) {
          return jsonResponse(400, { error: 'Room name is invalid' });
        }
        if (req.branch !== 'main') {
          // cookie users are main-only via getAccessType, but the admin
          // token bypasses it — reject explicitly so an admin create can't
          // seed an orphan non-main room (and dodge the 409 check, which is
          // branch-scoped)
          return jsonResponse(400, { error: 'Unknown branch' });
        }
        const body = await req.bytes();
        // req.bytes() resolves to a Node Buffer, but the compute-task schema
        // requires an exact Uint8Array (lib0 $constructedBy compares the
        // constructor) — re-view the same bytes without copying
        const update = new Uint8Array(
          body.buffer,
          body.byteOffset,
          body.byteLength,
        );
        if (update.byteLength > MAX_CREATE_BYTES) {
          // 413 is missing from yhub's status-line map, so the reason phrase
          // is empty ("HTTP/1.1 413 ") — legal, and callers switch on the code
          return jsonResponse(413, { error: 'Update too large' });
        }
        // <= 3 bytes is yhub's "no effective content" convention (an empty
        // update encodes to 2 bytes) — reject before it reaches a worker
        if (update.byteLength <= 3) {
          return jsonResponse(400, { error: 'Empty update' });
        }
        // covers persisted state AND uncompacted stream messages. Not atomic
        // with addMessage below (yhub has no atomic create): two concurrent
        // creates can both pass the check and their updates merge — with
        // independently generated updates (fresh clientIDs) the seeded
        // content then appears twice. Accepted: Django creates each doc
        // once, and a duplicated seed is user-fixable, unlike corruption.
        const { gcDoc } = await req.yhub.getDoc(
          req.room,
          { gc: true, nongc: false },
          { gcOnMerge: false },
        );
        if (gcDoc != null && gcDoc.byteLength > 3) {
          return jsonResponse(409, { error: 'Document already exists' });
        }
        // Only the backend admin token may attribute the content to another
        // user; regular callers always author as themselves — honoring a
        // client-supplied header would let any editor forge the attribution
        // history (the ws path likewise stamps the server-side identity).
        const userid =
          (req.authInfo.admin === true && req.headers['x-user-id']) ||
          req.authInfo.userid;
        let result;
        try {
          // diffs the posted update against the (empty) current doc and
          // stamps the attribution contentmap
          result = await req.yhub.computePool.patchYdoc(
            {
              update,
              currentDoc: gcDoc ?? EMPTY_YDOC,
              userid,
              customAttributions: [],
            },
            { room: req.room },
          );
        } catch {
          // a malformed update makes the compute worker throw (yhub logs
          // 'worker failed' and replaces the thread). The update is the only
          // untrusted input here, so a rejection maps to 400; getDoc /
          // addMessage failures stay generic 500s.
          return jsonResponse(400, { error: 'Invalid Yjs update' });
        }
        if (result == null) {
          // structurally valid but no effective content (e.g. delete-set
          // only). A "successful" create that leaves the room nonexistent
          // would lie to the caller — a later create would not 409.
          return jsonResponse(400, { error: 'Empty update' });
        }
        // on a fresh room this creates the stream, schedules compaction, and
        // fans out to any live subscribers — nothing else to do
        await req.yhub.stream.addMessage(req.room, {
          type: 'ydoc:update:v1',
          contentmap: result.contentmap,
          update: result.update,
        });
        return jsonResponse(201, { message: 'Document created' });
      },
    },
  }),
];

// the instance is referenced by the soft-migration helpers above — safe: auth
// callbacks only fire once the server is up, i.e. after this assignment
const yhub = await createYHub({
  redis: {
    url: REDIS,
    prefix: REDIS_PREFIX,
    taskDebounce: 10000,
    minMessageLifetime: 60000,
  },
  postgres: POSTGRES,
  persistence: [], // blobs live in yhub's postgres
  // apiPrefix mounts every route — built-ins, reset-connections, and the
  // websocket (/collaboration/ws/v1/{org}/{docid}) — under /collaboration/,
  // matching the URL scheme Docs already routes to the collaboration server.
  server: { port: PORT, auth, api, apiPrefix: 'collaboration' },
  worker: { taskConcurrency: 5 },
  // TODO(yhub): worker.events.docUpdate could push snapshots to Django and replace the
  // client useSaveDoc PATCH flow — blocked upstream: the payload is a DocTable without
  // room/org/docid (yhub src/index.js:90); needs an upstream change first.
});
