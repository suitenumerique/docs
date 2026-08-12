import { createHash, createPublicKey, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  apiError,
  createApiEndpoint,
  createAuthPlugin,
  createYHub,
  logger,
} from '@y/hub';
import {
  calculateJwkThumbprint,
  createRemoteJWKSet,
  exportJWK,
  importPKCS8,
  jwtVerify,
  SignJWT,
} from 'jose';
import { Client as S3Client } from 'minio';

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
// Segment every route is mounted under (`server.apiPrefix` below), matching the
// URL scheme Docs already routes to the collaboration server. Hardcoded like
// the audiences: the backend builds its urls with the same prefix.
const API_PREFIX = 'collaboration';
// Path the JWKS endpoint declared in `api` is mounted at. readAuthInfo reads
// the raw request, without any route context, hence the duplication.
const JWKS_PATH = `/${API_PREFIX}/jwks/v1`;
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

const touchLog = logger.child({ module: 'updated-at-notifier' });

const BACKEND_NOTIFY_TIMEOUT_MS = 5000;
// Audience of the tokens the backend accepts from us. It must match the one
// its CollaborationServerAuthentication requires, a token minted for anything
// else is refused there.
const BACKEND_AUDIENCE = 'docs-backend';
const BACKEND_TOKEN_LIFETIME_S = 60;
// Renew this long before expiry so a token never dies in flight.
const BACKEND_TOKEN_MARGIN_MS = 10000;

// We sign the calls we make to the backend, the mirror of the admin JWT it
// signs to call us: no long-lived shared secret, only our private key here and
// its public half published on the JWKS endpoint below.
const YHUB_JWT_PRIVATE_KEY = secret('YHUB_JWT_PRIVATE_KEY', '');
const backendSigningKey = YHUB_JWT_PRIVATE_KEY
  ? await importPKCS8(YHUB_JWT_PRIVATE_KEY, 'RS256')
  : null;

if (backendSigningKey == null) {
  // not fatal, documents keep being served — only their `updated_at` freezes
  touchLog.warn(
    'YHUB_JWT_PRIVATE_KEY is empty, the backend will not be notified of content updates',
  );
}

// The public half of the signing key, as published on the JWKS endpoint. Its
// "kid" is the RFC 7638 thumbprint of the key: computed from the public
// components only, it is stable across restarts and changes on its own when
// the key is rolled. Every token we sign carries it, which is how the backend
// picks the matching key — and how it knows to fetch the set again when it
// does not know the key yet, so rolling this key needs no change on its side.
const backendPublicJwk =
  backendSigningKey == null
    ? null
    : await (async () => {
        // derived from the PEM rather than exported from `backendSigningKey`:
        // exporting a private key as a JWK would carry its private components
        const jwk = await exportJWK(createPublicKey(YHUB_JWT_PRIVATE_KEY));
        return {
          ...jwk,
          alg: 'RS256',
          use: 'sig',
          kid: await calculateJwkThumbprint(jwk),
        };
      })();

/**
 * @type {{ token: string, expiresAt: number } | null}
 */
let backendToken = null;

// The token carries no per-document claim, so one is reused until it is about
// to expire rather than signing on every notification.
const getBackendToken = async () => {
  const now = Date.now();
  if (backendToken != null && backendToken.expiresAt - BACKEND_TOKEN_MARGIN_MS > now) {
    return backendToken.token;
  }
  const token = await new SignJWT({})
    // the "kid" names the key in our JWKS the backend must verify it with
    .setProtectedHeader({ alg: 'RS256', kid: backendPublicJwk.kid })
    .setIssuer('yhub')
    .setAudience(BACKEND_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${BACKEND_TOKEN_LIFETIME_S}s`)
    .sign(backendSigningKey);
  backendToken = { token, expiresAt: now + BACKEND_TOKEN_LIFETIME_S * 1000 };
  return token;
};

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
    const url = req.getUrl();
    const authorization = req.getHeader('authorization');
    const cookie = req.getHeader('cookie');
    const origin = req.getHeader('origin');
    const gcOff = req.getQuery('gc') === 'false';
    // The JWKS holds public keys and nothing else, and the backend must be
    // able to fetch it before it can authenticate anything we send it — so it
    // is served to anyone, as the backend serves its own. This identity is
    // granted the 'jwks' purpose and nothing else (getGlobalAccessType), and
    // the check is on the exact path of that one route.
    if (url === JWKS_PATH) {
      return { userid: 'anonymous' };
    }
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
  // Authorizes the global-scoped endpoints, of which the JWKS is the only one.
  async getGlobalAccessType(authInfo, purpose) {
    return purpose === 'jwks' ? 'r' : null;
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
  // GET /collaboration/jwks/v1 — the public keys verifying the tokens we sign
  // to call the backend, in the JSON Web Key Set format (RFC 7517). Global
  // scope: it is about this server, not about a document, so the route carries
  // no org and no docid. The counterpart of the backend's own /api/v1.0/jwks,
  // which we read above to verify its tokens: neither side stores a copy of
  // the other's key, so either can be rolled without the other being changed.
  createApiEndpoint('jwks', {
    scope: 'global',
    accessPurpose: 'jwks',
    get: {
      // an empty set when no key is configured: honest, and the backend
      // refuses our (equally absent) tokens rather than trusting anything
      handler: () =>
        jsonResponse(200, {
          keys: backendPublicJwk == null ? [] : [backendPublicJwk],
        }),
    },
  }),
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
        // `status` is what a backfill driver records per document: 'ok',
        // 'already', 'empty' (no legacy object — a brand-new document) or
        // 'nothing' (versions exist, none readable). All four are done, hence
        // one 2xx; `message` says the same thing to a human, `migrated`
        // whether this call is the one that wrote the history.
        const messages = {
          already: 'Already migrated',
          empty: 'No legacy document in s3',
          nothing: 'No usable content in the legacy versions',
          ok: 'Migration completed',
        };

        return jsonResponse(200, {
          status,
          message: messages[status],
          migrated: status === 'ok',
          ...stats,
        });
      },
    },
  }),
  // POST /collaboration/create-ydoc/v1/{org}/{docid} — create a document's
  // initial Yjs state from a RAW binary update (`Y.encodeStateAsUpdate` /
  // pycrdt `get_update()` output) posted as application/octet-stream.
  //
  // The built-in `PATCH ydoc` takes the same update (base64, in a json body
  // since 0.5.0) but neither of the two things this endpoint exists for: it is
  // a strict create, answering 409 when the room already has content, and it
  // attributes the content to the user named in `X-User-Id` rather than to the
  // backend making the call. Reads have no such needs and use the built-in
  // `GET ydoc`. Default access purpose: guarded like the built-in ydoc routes
  // (write access on the doc — the admin JWT, or a user session with update
  // ability).
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
  // POST /collaboration/restore-ydoc/v1/{org}/{docid} — undo the deletion of a
  // document, putting back what `DELETE .../ydoc/` took away.
  //
  // Deleting has a built-in route, restoring does not: yhub 0.6.0 exposes
  // `restoreDoc` to the process embedding it and nothing else. Backend-internal
  // like reset-connections and migrate, gated to the admin token by the
  // 'restore' purpose — a document leaves the trashbin because the backend
  // says so, never because an editor asked.
  createApiEndpoint('restore-ydoc', {
    accessPurpose: 'restore',
    post: {
      handler: async (req) => {
        if (req.org !== ORG) {
          return jsonResponse(400, { error: 'Unknown org' });
        }
        if (!UUID4.test(req.docid)) {
          return jsonResponse(400, { error: 'Room name is invalid' });
        }
        if (req.branch !== 'main') {
          // as in create-ydoc: the admin token is not fenced to main by
          // getAccessType, and a deletion is recorded per branch
          return jsonResponse(400, { error: 'Unknown branch' });
        }
        // read the deletion before undoing it: `restoreDoc` throws a plain
        // Error for a document whose content was erased, and that is a
        // conflict to report as one — catching around the call would turn
        // every failure alike, a database outage included, into the same answer
        const tombstone = await req.yhub.persistence.retrieveTombstone(req.room);
        if (tombstone == null) {
          // not an error: the backend restores a whole subtree, of which only
          // the part that was deleted with it has anything to put back
          return jsonResponse(200, {
            message: 'Document is not deleted',
            restored: false,
          });
        }
        if (tombstone.hard || tombstone.purgedAt != null) {
          return jsonResponse(409, { error: 'Document content was erased' });
        }
        await req.yhub.restoreDoc(req.room);
        return jsonResponse(200, {
          message: 'Document restored',
          restored: true,
        });
      },
    },
  }),
];

// Django orders the document lists by `updated_at` and no edit goes through it
// anymore, so it is told here that a document moved on.
const touchDocument = async (docid) => {
  if (backendSigningKey == null) return;
  try {
    const res = await fetch(
      `${COLLABORATION_BACKEND_BASE_URL}/api/v1.0/documents/${docid}/content-updated/`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${await getBackendToken()}` },
        signal: AbortSignal.timeout(BACKEND_NOTIFY_TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      touchLog.warn({ docid, status: res.status }, 'backend refused the notification');
    }
  } catch (err) {
    // best effort: a lost notification only leaves `updated_at` behind until
    // the document is edited again, it must never fail a compaction
    touchLog.warn({ err, docid }, 'could not notify the backend');
  }
};

// `docUpdate` is the worker event for "this compaction found new content": the
// task returns before it when it has nothing to persist, so the awareness-only
// traffic of someone merely opening a document never reaches it. Since yhub
// 0.5.0 it is handed the room of the task alongside the merged document.
const workerEvents = {
  docUpdate: ({ room }) => {
    // Django knows the documents of this org, on the main branch, by their uuid
    if (room.org !== ORG || room.branch !== 'main' || !UUID4.test(room.docid)) {
      return;
    }
    // deliberately not awaited: a slow backend must not hold the worker
    touchDocument(room.docid);
  },
};

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
  // apiPrefix mounts every route — built-ins, our custom endpoints, and the
  // websocket (/collaboration/ws/v1/{org}/{docid}) — under /collaboration/.
  server: { port: PORT, auth, api, apiPrefix: API_PREFIX },
  worker: { taskConcurrency: 5, events: workerEvents },
});
