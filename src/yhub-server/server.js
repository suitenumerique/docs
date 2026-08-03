import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { createAuthPlugin, createYHub } from '@y/hub';

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

const backendFetch = async (path, { cookie, origin }) => {
  const res = await fetch(`${COLLABORATION_BACKEND_BASE_URL}${path}`, {
    headers: {
      cookie,
      origin,
      'X-Y-Provider-Key': Y_PROVIDER_API_KEY,
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${path}: ${res.status}`);
  }
  return res.json();
};

const auth = createAuthPlugin({
  // uws req is only valid synchronously — read headers AND query before first await.
  async readAuthInfo(req) {
    const cookie = req.getHeader('cookie');
    const origin = req.getHeader('origin');
    const gcOff = req.getQuery('gc') === 'false';
    if (gcOff) return null; // full-history connections: not for Docs users
    if (!origin || !allowedOrigins.includes(origin)) return null; // was 4001 'Origin not allowed'
    if (!cookie) return null; // was 4001 'No cookies'
    try {
      const user = await backendFetch('/api/v1.0/users/me/', {
        cookie,
        origin,
      });
      return { userid: String(user.id), cookie, origin }; // MUST be string (yhub server.js:667)
    } catch {
      // anonymous (public docs): stable per-session id — random ids would mint a new
      // permanent attribution identity per reconnect
      const anon = createHash('sha256')
        .update(cookie)
        .digest('base64url')
        .slice(0, 16);
      return { userid: `anon:${anon}`, cookie, origin };
    }
  },
  async getAccessType(authInfo, { org, docid, branch }) {
    if (org !== ORG || branch !== 'main' || !UUID4.test(docid)) {
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

await createYHub({
  redis: {
    url: REDIS,
    prefix: REDIS_PREFIX,
    taskDebounce: 10000,
    minMessageLifetime: 60000,
  },
  postgres: POSTGRES,
  persistence: [], // blobs live in yhub's postgres
  server: { port: PORT, auth },
  worker: { taskConcurrency: 5 },
  // TODO(yhub): worker.events.docUpdate could push snapshots to Django and replace the
  // client useSaveDoc PATCH flow — blocked upstream: the payload is a DocTable without
  // room/org/docid (yhub src/index.js:90); needs an upstream change first.
});
