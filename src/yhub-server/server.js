import { createHash, createPublicKey, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  apiError,
  createApiEndpoint,
  createAuthPlugin,
  createYHub,
  logger,
} from '@y/hub';
import { S3PersistenceV1 } from '@y/hub/plugins/s3';
import {
  calculateJwkThumbprint,
  createRemoteJWKSet,
  exportJWK,
  importPKCS8,
  jwtVerify,
  SignJWT,
} from 'jose';

import { secret } from './env.js';
// legacy Django/S3 document store — see migration.js and README.md
import {
  SOFT_MIGRATION,
  fullMigrate,
  isPermanentFailure,
  maybeMigrate,
  migrationLog,
} from './migration.js';

// A numeric setting, read from the environment and refused rather than guessed
// when it is not a whole number at or above `min`: `Number()` reads a typo as
// NaN, which yhub takes as-is and turns into a worker that claims nothing or a
// stream that is never trimmed — a deployment that looks healthy and is not.
// An unset or empty variable is the default, so a kubernetes env var left blank
// behaves as if it had not been set at all.
const intEnv = (name, dflt, min = 1) => {
  const raw = process.env[name];
  const value = raw == null || raw === '' ? dflt : Number(raw);
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`${name} must be an integer >= ${min} (got "${raw}")`);
  }
  return value;
};

const PORT = Number(process.env.PORT || 3002);
const REDIS = process.env.REDIS;
const POSTGRES = process.env.POSTGRES;
const REDIS_PREFIX = process.env.REDIS_PREFIX || 'yhub';
// How long an update waits on the stream before a worker claims the compaction
// task it belongs to. It is the delay between an edit and its row in postgres,
// and the window over which the edits of a busy document are merged into one
// task: lowering it persists sooner and compacts more often, raising it does
// the reverse. yhub defaults to 120s, which is a long time to lose when a pod
// is killed — Docs asks for 10s.
const TASK_DEBOUNCE_MS = intEnv('YHUB_TASK_DEBOUNCE_MS', 10000, 0);
// How long messages a worker has already persisted are kept on the stream. The
// trim stops at the older of that age and the point postgres holds, so this is
// not a durability setting — nothing unpersisted is ever trimmed. It is how
// much recent history stays replayable from redis instead of being read back
// out of postgres, paid for in memory on the redis side.
const MIN_MESSAGE_LIFETIME_MS = intEnv('YHUB_MIN_MESSAGE_LIFETIME_MS', 60000, 0);
const COLLABORATION_BACKEND_BASE_URL =
  process.env.COLLABORATION_BACKEND_BASE_URL || 'http://app-dev:8000';
const allowedOrigins = (
  process.env.COLLABORATION_SERVER_ORIGIN || 'http://localhost:3000'
).split(',');
const Y_PROVIDER_API_KEY = secret('Y_PROVIDER_API_KEY', 'yprovider-api-key');
const ORG = process.env.YHUB_ORG || 'docs';
// Which halves of yhub this process runs. The server accepts the websocket
// connections and serves the REST routes; the worker drains the redis stream
// into postgres. They share the two stores and nothing else — no in-process
// state, no ordering between them — so one process can run both (the default)
// or a deployment can split them and scale each on its own: the server with
// the connected editors, the worker with the write throughput.
//
// A stream is only drained by the workers that are running: a deployment of
// `server` alone keeps accepting edits and never persists them, so the two
// halves are split together or not at all.
const ROLE = process.env.YHUB_ROLE || 'all';
if (!['all', 'server', 'worker'].includes(ROLE)) {
  throw new Error(
    `YHUB_ROLE must be one of "all", "server" or "worker" (got "${ROLE}")`,
  );
}
const RUNS_SERVER = ROLE !== 'worker';
const RUNS_WORKER = ROLE !== 'server';
// How many tasks one worker process claims at once. Redis hands each task to a
// single worker, so what a deployment actually runs in parallel is this times
// the number of worker processes — the two knobs are interchangeable up to the
// point where a pod runs out of memory, each task holding the document it
// merges.
const TASK_CONCURRENCY = intEnv('YHUB_TASK_CONCURRENCY', 5, 1);
// Where the blobs of a compaction go — the garbage-collected document, the one
// that keeps its history, the content map and the content ids. yhub writes the
// four of them into its own postgres; a persistence plugin takes them out of
// it, the row then holding a reference and the bytes living in the plugin's
// store. Off by default, which is postgres alone, the way Docs has been
// running.
//
// Not a switch that can be flipped back: a row pointing at an object is
// unreadable without the plugin that wrote it — yhub reports that version as
// having no content rather than as an error — so turning it off after a
// compaction strands what was stored while it was on. See README.md.
const S3_PERSISTENCE = process.env.YHUB_S3_PERSISTENCE === 'true';
// Its own bucket, named apart from the backend's `AWS_S3_*` and from the legacy
// document store's `LEGACY_S3_*` (migration.js): three buckets that may sit on
// three providers with credentials of their own, each read by the process it
// belongs to.
const YHUB_S3_ENDPOINT_URL = process.env.YHUB_S3_ENDPOINT_URL;
const YHUB_S3_ACCESS_KEY_ID = secret('YHUB_S3_ACCESS_KEY_ID');
const YHUB_S3_SECRET_ACCESS_KEY = secret('YHUB_S3_SECRET_ACCESS_KEY');
const YHUB_S3_BUCKET_NAME = process.env.YHUB_S3_BUCKET_NAME;
const YHUB_S3_REGION_NAME = process.env.YHUB_S3_REGION_NAME;
// Segment every route is mounted under (`server.apiPrefix` below), matching the
// URL scheme Docs already routes to the collaboration server. Hardcoded like
// the audiences: the backend builds its urls with the same prefix.
const API_PREFIX = 'collaboration';
// Paths of the routes declared in `api` that are served to anyone: the JWKS,
// which carries public keys and which the backend must read before it can
// authenticate anything we send it, and the two probes, which kubernetes calls
// with no cookie and no token. readAuthInfo reads the raw request, without any
// route context, hence the duplication of the paths here.
const PUBLIC_PATHS = new Set([
  `/${API_PREFIX}/jwks/v1`,
  `/${API_PREFIX}/ping/v1`,
  `/${API_PREFIX}/ready/v1`,
]);
// What the readiness check gives a store before reporting it unreachable. Short
// on purpose: the point of the probe is to answer, and answering "not ready"
// early is more useful than holding the connection until kubelet times out.
const READINESS_TIMEOUT_MS = 2000;
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
// yhub's "no effective content" convention: an empty update encodes to 2 bytes,
// and anything up to 3 is read as an empty document
const EMPTY_UPDATE_MAX_BYTES = 3;
// uws buffers the whole body before the handler sees it, so this cap does not
// bound upload memory — it bounds what a single create hands to a compute
// worker and writes to the valkey stream as one message. Creates carry one
// freshly-converted snapshot (typically KBs); anything bigger belongs on the
// websocket path.
const MAX_CREATE_BYTES = 10 * 1024 * 1024;

const touchLog = logger.child({ module: 'updated-at-notifier' });
const resetLog = logger.child({ module: 'reset-ydoc' });

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
//   the legacy object cannot be migrated (it does not decode) — retrying will
//     not change that, so the room opens as a new document. Refusing instead
//     would lock a document nobody can repair from the outside. Logged per
//     access, because the caller is now editing alongside legacy content that
//     stayed behind in S3.
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
    // The JWKS and the probes are served to anyone (see PUBLIC_PATHS). This
    // identity is granted their purposes and nothing else
    // (getGlobalAccessType), and the check is on their exact paths.
    if (PUBLIC_PATHS.has(url)) {
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
  // Authorizes the global-scoped endpoints: the JWKS and the two probes, all
  // of them read-only and public. Anything else is refused here.
  async getGlobalAccessType(authInfo, purpose) {
    return purpose === 'jwks' || purpose === 'ping' || purpose === 'ready'
      ? 'r'
      : null;
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

// Does the room hold anything? Covers persisted rows and the messages still on
// the stream, which is what makes it an answer about the content rather than
// about the storage.
const hasContent = async (yhub, room) => {
  const { gcDoc } = await yhub.getDoc(
    room,
    { gc: true, nongc: false },
    { gcOnMerge: false },
  );
  return gcDoc != null && gcDoc.byteLength > EMPTY_UPDATE_MAX_BYTES;
};

// Erase every trace of a room's content and leave it writable again.
//
// The erasure is yhub's hard deletion: it clears the stream, disconnects the
// editors and drops every row and asset, irreversibly. Its tombstone is also
// the barrier that stops a compaction still in flight from writing the content
// back — every `store` is refused while it is there, and the purge runs behind
// it — so the room is only made writable again, by dropping the tombstone,
// once there is nothing left to write back.
//
// Dropping the tombstone is what makes this a reset rather than a deletion:
// yhub has no such operation, a hard deletion is final for the room and even
// `restoreDoc` refuses it. Here the document id belongs to a Django document
// that goes on living, so the room has to be usable again.
const eraseContent = async (yhub, room, by) => {
  await yhub.deleteDoc(room, { hard: true, by });
  await yhub.persistence.deleteTombstone(room);
};

const readyLog = logger.child({ module: 'readiness' });

// One readiness check: is that store answering? The error never leaves the
// server — the route is unauthenticated, and a postgres client is happy to put
// its connection string, password included, in the message it raises.
const checkStore = async (name, probe) => {
  let timer;
  try {
    await Promise.race([
      probe(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`no answer in ${READINESS_TIMEOUT_MS}ms`)),
          READINESS_TIMEOUT_MS,
        );
      }),
    ]);
    return [name, 'ok'];
  } catch (err) {
    readyLog.warn({ store: name, err: err?.message }, 'store is unreachable');
    return [name, 'unreachable'];
  } finally {
    clearTimeout(timer);
  }
};

const api = [
  // GET /collaboration/ping/v1 — liveness. It answers, therefore the http
  // channel and the event loop are alive, which is all a liveness probe should
  // ever conclude: touching redis or postgres here would restart a server that
  // holds perfectly good websocket connections every time a store blinks.
  createApiEndpoint('ping', {
    scope: 'global',
    accessPurpose: 'ping',
    get: {
      handler: () => jsonResponse(200, { status: 'pong' }),
    },
  }),
  // GET /collaboration/ready/v1 — readiness. The two stores this server cannot
  // serve a single document without: the postgres holding the persisted state
  // and the redis carrying the updates between replicas. Answering 503 takes
  // this pod out of the service endpoints and leaves the others serving, which
  // is the whole difference with the liveness probe above.
  createApiEndpoint('ready', {
    scope: 'global',
    accessPurpose: 'ready',
    get: {
      handler: async (req) => {
        // both at once: a probe is not the place to add the latency of one
        // store to the latency of the other
        const checks = Object.fromEntries(
          await Promise.all([
            checkStore('postgres', () => req.yhub.persistence.sql`SELECT 1`),
            checkStore('redis', () => req.yhub.stream.redis.ping()),
          ]),
        );
        const ready = Object.values(checks).every((state) => state === 'ok');
        return jsonResponse(ready ? 200 : 503, {
          status: ready ? 'ready' : 'unready',
          checks,
        });
      },
    },
  }),
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
        // yhub's "no effective content" convention — reject before it reaches
        // a worker
        if (update.byteLength <= EMPTY_UPDATE_MAX_BYTES) {
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
        if (gcDoc != null && gcDoc.byteLength > EMPTY_UPDATE_MAX_BYTES) {
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
  // POST /collaboration/reset-ydoc/v1/{org}/{docid} — erase the content of a
  // document and leave the room usable, as if it had never been written.
  //
  // What the backend's `clean_document` command needs to reset the onboarding
  // sandbox: the Django document keeps its id and goes on being edited, so
  // deleting the room is not an option — a hard deletion is final and even a
  // soft one would answer 404 for a document that still exists. Backend-internal
  // and admin-only, like the deletions it is built on: this destroys content
  // with no way back.
  createApiEndpoint('reset-ydoc', {
    accessPurpose: 'reset',
    post: {
      handler: async (req) => {
        if (req.org !== ORG) {
          return jsonResponse(400, { error: 'Unknown org' });
        }
        if (!UUID4.test(req.docid)) {
          return jsonResponse(400, { error: 'Room name is invalid' });
        }
        if (req.branch !== 'main') {
          return jsonResponse(400, { error: 'Unknown branch' });
        }
        const by = req.headers['x-user-id'] || req.authInfo.userid;
        // Nothing compacts this room while the erasure runs: this drops the
        // task already waiting for it and refuses to enqueue another, which
        // leaves one writer to race with — a task a worker had claimed before
        // this call. The tombstone barrier covers it right up to the moment
        // the room is made writable again, so it can only land after that,
        // and the second pass below is what picks it up.
        await req.yhub.stream.disableCompaction(req.room);
        try {
          await eraseContent(req.yhub, req.room, by);
          if (await hasContent(req.yhub, req.room)) {
            resetLog.warn(
              { docid: req.docid },
              'content came back while it was being erased, erasing again',
            );
            await eraseContent(req.yhub, req.room, by);
            if (await hasContent(req.yhub, req.room)) {
              // saying it is erased when it is not is the one answer this
              // endpoint must never give
              return jsonResponse(500, {
                error: 'Document content came back after being erased',
              });
            }
          }
        } finally {
          // even on failure: leaving compaction off would freeze the room for
          // every later edit, a worse state than the one we came to fix
          await req.yhub.stream.enableCompaction(req.room);
        }
        return jsonResponse(200, { message: 'Document content erased' });
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

// The persistence plugins yhub consults, in order, before writing a blob to
// postgres and before reading one back. An empty list keeps everything in the
// database, which is the default.
//
// Read here rather than in the call below so that an incomplete configuration
// is a startup error naming what is missing: the client would otherwise be
// built anonymous or against the wrong host and only say so on the first
// compaction, which is a background task — the failure would show up as
// documents quietly not being persisted.
const persistencePlugins = () => {
  if (!S3_PERSISTENCE) return [];

  const missing = [
    ['YHUB_S3_ENDPOINT_URL', YHUB_S3_ENDPOINT_URL],
    ['YHUB_S3_ACCESS_KEY_ID', YHUB_S3_ACCESS_KEY_ID],
    ['YHUB_S3_SECRET_ACCESS_KEY', YHUB_S3_SECRET_ACCESS_KEY],
    ['YHUB_S3_BUCKET_NAME', YHUB_S3_BUCKET_NAME],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`YHUB_S3_PERSISTENCE=true requires ${missing.join(', ')}`);
  }

  const url = new URL(YHUB_S3_ENDPOINT_URL);
  if (url.pathname !== '/' && url.pathname !== '') {
    // the client is given a host and a port, so a base path would be dropped
    // without a word and the objects written next to where they belong
    throw new Error('YHUB_S3_ENDPOINT_URL must not contain a path');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    // the client is told "SSL or not", so any other scheme would read as "not"
    // and send the credentials in clear
    throw new Error('YHUB_S3_ENDPOINT_URL must be http:// or https://');
  }
  const useSSL = url.protocol === 'https:';

  return [
    new S3PersistenceV1({
      bucket: YHUB_S3_BUCKET_NAME,
      endPoint: url.hostname,
      // an implicit port parses as "", which the client reads as 0 — its way
      // of saying "whatever the scheme defaults to"
      port: Number(url.port),
      useSSL,
      accessKey: YHUB_S3_ACCESS_KEY_ID,
      secretKey: YHUB_S3_SECRET_ACCESS_KEY,
      // left out rather than passed empty: unset, the client discovers the
      // region of the bucket instead of validating an empty string
      ...(YHUB_S3_REGION_NAME ? { region: YHUB_S3_REGION_NAME } : {}),
    }),
  ];
};

// the instance is referenced by the soft-migration helpers above — safe: auth
// callbacks only fire once the server is up, i.e. after this assignment
const yhub = await createYHub({
  redis: {
    url: REDIS,
    prefix: REDIS_PREFIX,
    taskDebounce: TASK_DEBOUNCE_MS,
    minMessageLifetime: MIN_MESSAGE_LIFETIME_MS,
  },
  postgres: POSTGRES,
  // where the blobs live: nothing here keeps them in yhub's postgres
  persistence: persistencePlugins(),
  // Both halves are declared, and YHUB_ROLE decides which are built: a null
  // server binds no port at all (a `worker` pod has no http surface, hence no
  // probes and no service in front of it), a null worker claims no task.
  //
  // apiPrefix mounts every route — built-ins, our custom endpoints, and the
  // websocket (/collaboration/ws/v1/{org}/{docid}) — under /collaboration/.
  server: RUNS_SERVER
    ? { port: PORT, auth, api, apiPrefix: API_PREFIX }
    : null,
  worker: RUNS_WORKER
    ? { taskConcurrency: TASK_CONCURRENCY, events: workerEvents }
    : null,
});

// What this process was configured to be, in one line: yhub's own startup log
// reports neither the role nor the stream settings, and every one of them is an
// environment variable a deployment can get wrong. The two timings are read
// back off the instance rather than from the constants above, so the line says
// what yhub is using and not merely what it was asked for.
logger.info(
  {
    role: ROLE,
    server: RUNS_SERVER,
    worker: RUNS_WORKER,
    taskConcurrency: RUNS_WORKER ? TASK_CONCURRENCY : null,
    // where the compaction blobs go — null is yhub's own postgres
    s3Bucket: S3_PERSISTENCE ? YHUB_S3_BUCKET_NAME : null,
    taskDebounceMs: yhub.stream.taskDebounce,
    minMessageLifetimeMs: yhub.stream.minMessageLifetime,
  },
  'yhub configuration',
);
