import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { createApiEndpoint, createAuthPlugin, createYHub } from '@y/hub';
import { createRemoteJWKSet, jwtVerify } from 'jose';

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
const UUID4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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
          clockTolerance: 5,
        });
        // admin tokens act as the "system" user (no per-user admin identities yet)
        return payload.admin === true
          ? { userid: 'system', admin: true }
          : null;
      } catch {
        return null; // bad signature / expired / JWKS unreachable — fail closed
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
    try {
      const doc = await backendFetch(
        `/api/v1.0/documents/${docid}/`,
        authInfo,
      );
      if (!doc.abilities?.retrieve) {
        return null;
      }
      return doc.abilities.update ? 'rw' : 'r';
    } catch {
      return null;
    }
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
        // creates can both pass — acceptable, Yjs merges both updates; worst
        // case is a doubly-attributed first revision, never corruption.
        const { gcDoc } = await req.yhub.getDoc(
          req.room,
          { gc: true, nongc: false },
          { gcOnMerge: false },
        );
        if (gcDoc != null && gcDoc.byteLength > 3) {
          return jsonResponse(409, { error: 'Document already exists' });
        }
        // attribute the initial content to the acting user when the caller
        // names one, else to the caller's identity ('system' for admin tokens)
        const userid = req.headers['x-user-id'] || req.authInfo.userid;
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

await createYHub({
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
