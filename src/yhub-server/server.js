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
