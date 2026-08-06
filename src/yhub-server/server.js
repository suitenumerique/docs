import { createHash } from 'node:crypto';

import {
  apiError,
  createApiEndpoint,
  createAuthPlugin,
  createYHub,
} from '@y/hub';
import { createRemoteJWKSet, jwtVerify } from 'jose';

import { secret } from './env.js';
// legacy Django/S3 document store — see migration.js and README.md
import {
  SOFT_MIGRATION,
  fullMigrate,
  isPermanentFailure,
  maybeMigrate,
  migrationLog,
} from './migration.js';

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

// First access to a room yhub does not know: seed it from the legacy Django S3
// store before admitting the caller. Awaited inside the upgrade handler, so the
// post-upgrade initial sync (which merges postgres and the stream from clock 0)
// is guaranteed to include the seed.
//
// Seeding never decides whether the caller may read the document — that is the
// backend's answer alone. There are two ways this ends other than a seed:
//
//   the legacy object cannot be migrated (it does not decode, or it is bigger
//     than we will load) — retrying will not change that, so the room opens as
//     a new document. Refusing instead would lock a document nobody can repair
//     from the outside. Logged per access, because the caller is now editing
//     alongside legacy content that stayed behind in S3.
//   the legacy store could not be reached (timeout, network, backpressure) —
//     the same request later may well succeed, so it answers 503 rather than
//     silently starting an empty document on top of content that exists.
const seedFromLegacyStore = async (room) => {
  try {
    // `yhub` is declared at the bottom of this file — safe: auth callbacks only
    // fire once the server is up, i.e. after that assignment
    await maybeMigrate(yhub, room);
  } catch (err) {
    if (!isPermanentFailure(err)) {
      throw apiError(503, 'Legacy document store is unavailable');
    }
    // why it failed was logged once, at the attempt, inside maybeMigrate
    migrationLog.warn(
      { event: 'seed.skipped', docid: room.docid, err: err?.message },
      'admitting caller to a document that could not be migrated; it opens as new',
    );
  }
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
      } catch (err) {
        // jose tags every token-validation failure with an `ERR_J…` code (bad
        // signature, expired, wrong or missing audience) — those are permanent,
        // fail closed. A JWKS fetch that times out or never connects has no
        // such code (or ERR_JWKS_TIMEOUT): the token may be perfectly valid and
        // we simply cannot check it, so report it as retryable instead of
        // accusing the caller of forging it.
        if (
          err?.code === 'ERR_JWKS_TIMEOUT' ||
          typeof err?.code !== 'string' ||
          !err.code.startsWith('ERR_J')
        ) {
          throw apiError(503, 'Token verification keys are unavailable');
        }
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
      // On backend failure (5xx/network) still refuse to admit the connection —
      // a signed-in editor authorized under an anon userid would be invisible
      // to the targeted reset-connections recheck (users: [<uuid>]) for the
      // connection's whole lifetime — but report it as retryable rather than as
      // an authentication failure the client should give up on.
      if (err?.status !== 401 && err?.status !== 403) {
        throw apiError(503, 'Authentication backend is unavailable');
      }
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
    if (authInfo.admin === true) {
      // Django's admin token: full access. It still goes through the legacy
      // seed, on the same terms as a user (default purpose only, so a
      // `migrate` call is not seeded out from under fullMigrate). Without it a
      // backend read of an unmigrated document would answer with an *empty*
      // doc, and a create-ydoc against one would write a second lineage next
      // to the legacy content the first user access is about to seed in.
      // Access itself is never in question here — the token already granted it.
      // The same org/branch fence the user path applies below. The admin token
      // is the only identity that can name an arbitrary org or branch, and the
      // legacy store is branchless — `{docid}/file` *is* main — so seeding any
      // other room would write main's content into an orphan room, and the
      // per-docid verdict cache would then report that docid as done and leave
      // the real room empty.
      if (
        SOFT_MIGRATION &&
        purpose == null &&
        org === ORG &&
        branch === 'main' &&
        UUID4.test(docid)
      ) {
        await seedFromLegacyStore({ org, docid, branch });
      }
      return 'rw';
    }
    // Regular users only get access for the default purpose — custom-endpoint
    // purposes (reset-connections, migrate) are backend-internal. Loose != on
    // purpose: ws upgrades and rechecks pass undefined, built-in rest
    // endpoints null.
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
    } catch (err) {
      // the backend answered "no": a real, permanent denial (403 Forbidden)
      if (err?.status === 401 || err?.status === 403 || err?.status === 404) {
        return null;
      }
      // it did not answer at all — say so, so the caller retries instead of
      // reading a 5xx or a network blip as a permission decision
      throw apiError(503, 'Document authorization backend is unavailable');
    }
    if (!doc.abilities?.retrieve) {
      return null;
    }
    // the backend has already decided the caller may read this document; the
    // seed only decides what is in it
    if (SOFT_MIGRATION) {
      await seedFromLegacyStore({ org, docid, branch });
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
  // POST /collaboration/migrate/v1/{org}/{docid} — replay a document's full
  // legacy version history from the S3 media bucket into yhub (see README.md).
  // Backend-internal, like reset-connections: gated to the admin token via the
  // 'migrate' access purpose, since it writes history and reads the legacy
  // store.
  createApiEndpoint('migrate', {
    accessPurpose: 'migrate',
    post: {
      handler: async (req) => {
        if (req.org !== ORG) {
          return jsonResponse(400, { error: 'Unknown org' });
        }
        if (!UUID4.test(req.docid)) {
          return jsonResponse(400, { error: 'Room name is invalid' });
        }
        if (req.branch !== 'main') {
          // the legacy store is branchless: `{docid}/file` is the main branch
          return jsonResponse(400, { error: 'Unknown branch' });
        }
        if (!SOFT_MIGRATION) {
          // the flag is what configures the S3 client (migration.js)
          return jsonResponse(503, { error: 'Legacy store is not configured' });
        }
        // ?force=true replays a document that is already in the migrated set.
        // Only safe while its clock-0 row is still there: once compaction has
        // folded that row away, a second replay attributes the same content a
        // second time and the activity timestamps become ambiguous.
        const { status, ...stats } = await fullMigrate(req.yhub, req.room, {
          force: req.query.force === 'true',
        });
        if (status === 'already') {
          return jsonResponse(200, {
            message: 'Already migrated',
            migrated: false,
          });
        }
        if (status === 'empty') {
          // brand-new documents never had a legacy object; nothing to replay
          // and nothing wrong — a backfill driver treats this as done
          return jsonResponse(200, {
            message: 'No legacy document in s3',
            migrated: false,
            ...stats,
          });
        }
        if (status === 'nothing') {
          return jsonResponse(200, {
            message: 'No usable content in the legacy versions',
            migrated: false,
            ...stats,
          });
        }
        return jsonResponse(200, {
          message: 'Migration completed',
          migrated: true,
          ...stats,
        });
      },
    },
  }),
  // GET /collaboration/get-ydoc/v1/{org}/{docid} — the current state of a
  // document as a RAW binary update (`Y.encodeStateAsUpdate` output), the read
  // counterpart of create-ydoc: yhub's built-in `GET ydoc` answers a lib0-any
  // encoded `{ doc, awareness }` envelope Django cannot decode. Answers 204
  // when the room holds no content. Default access purpose: guarded like the
  // built-in ydoc routes (read access on the doc — the admin JWT, or a user
  // session able to retrieve it).
  createApiEndpoint('get-ydoc', {
    get: {
      handler: async (req) => {
        if (req.org !== ORG) {
          return jsonResponse(400, { error: 'Unknown org' });
        }
        if (!UUID4.test(req.docid)) {
          return jsonResponse(400, { error: 'Room name is invalid' });
        }
        const { gcDoc } = await req.yhub.getDoc(
          req.room,
          { gc: true, nongc: false },
          { gcOnMerge: false },
        );
        // <= 3 bytes is yhub's "no effective content" convention (an empty
        // update encodes to 2 bytes) — nothing to copy. `null` answers 204.
        if (gcDoc == null || gcDoc.byteLength <= 3) {
          return null;
        }
        // a Uint8Array is served as application/octet-stream, untouched
        return gcDoc;
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
          // 413 is missing from yhub's status-line map (503 was added in
          // 0.5.0, 413 was not), so the reason phrase is empty
          // ("HTTP/1.1 413 ") — legal, and callers switch on the code
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

// referenced by getAccessType above — safe: auth callbacks only fire once the
// server is up, i.e. after this assignment
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
  // client useSaveDoc PATCH flow. No longer blocked upstream — yhub 0.5.0 adds `room`
  // to the event payload, which was the missing piece.
});
