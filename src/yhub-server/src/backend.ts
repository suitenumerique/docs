/**
 * Everything this server sends to the Docs Django backend, and the keys both
 * ends verify each other with.
 *
 *   `backendFetch` — a GET carrying the caller's session
 *   `resolveUserid`, `resolveAbilities`, `resolveAccess` — the three questions
 *     the auth plugin asks about a caller (`/users/me/`,
 *     `/documents/{id}/abilities/`, `/documents/{id}/accesses/me/`), answered
 *     through the authz cache
 *   `touchDocument` — the `content-updated` notification a compaction fires
 *   `JWKS` — Django's public keys, for verifying the admin tokens it signs to
 *     call us (consumed by `server.ts`)
 *   `backendPublicJwk` — the public half of *our* signing key, as the
 *     `/collaboration/jwks/v1` route publishes it
 *
 * The two token directions are symmetric: neither side stores the other's key,
 * so either can be rolled without a change here.
 */
import { createPublicKey } from 'node:crypto';

import { apiError, logger } from '@y/hub';
import type { JWK } from 'jose';
import {
  calculateJwkThumbprint,
  createRemoteJWKSet,
  exportJWK,
  importPKCS8,
  SignJWT,
} from 'jose';

import type { CachedAbilities } from './authz-cache.js';
import { cachedAbilities, cachedAccess, identityCache } from './authz-cache.js';
import type { AccessPayload, DocumentAbilities } from './permissions.js';
import {
  ANONYMOUS_USERID,
  BACKEND_AUDIENCE,
  BACKEND_NOTIFY_TIMEOUT_MS,
  BACKEND_REQUEST_TIMEOUT_MS,
  BACKEND_TOKEN_LIFETIME_S,
  BACKEND_TOKEN_MARGIN_MS,
  COLLABORATION_BACKEND_BASE_URL,
  SESSION_COOKIE_NAME,
  Y_PROVIDER_API_KEY,
  YHUB_JWT_PRIVATE_KEY,
} from './config.js';
import { timedBackendRequest } from './metrics.js';
import type { AppAuthInfo, YHub } from './yhub.js';

// The shape of the backend payload a caller name resolves to.
export interface BackendUser {
  id: string | number;
}
// `GET /api/v1.0/documents/{id}/abilities/` — only the abilities the policy
// reads.
export interface BackendDocument {
  abilities?: DocumentAbilities;
}

// Whether a caller's `Cookie` header carries the backend's session cookie.
// The backend only ever speaks sessions through that one cookie, so a header
// carrying others (csrf, consent, …) but not this one can only resolve to the
// anonymous identity — the `users/me` call would answer 401 — and
// `authenticate` answers it as such without the roundtrip.
export const carriesSessionCookie = (cookieHeader: string): boolean =>
  cookieHeader
    .split(';')
    .some((pair) => pair.split('=')[0].trim() === SESSION_COOKIE_NAME);

const touchLog = logger.child({ module: 'updated-at-notifier' });

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
export const backendPublicJwk: (JWK & { kid: string }) | null =
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

let backendToken: { token: string; expiresAt: number } | null = null;

// The token carries no per-document claim, so one is reused until it is about
// to expire rather than signing on every notification.
const getBackendToken = async (): Promise<string> => {
  if (backendSigningKey == null || backendPublicJwk == null) {
    throw new Error('no backend signing key is configured');
  }
  const now = Date.now();
  if (
    backendToken != null &&
    backendToken.expiresAt - BACKEND_TOKEN_MARGIN_MS > now
  ) {
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
export const JWKS = createRemoteJWKSet(
  new URL(`${COLLABORATION_BACKEND_BASE_URL}/api/v1.0/jwks`),
);

export const backendFetch = async <T = unknown>(
  path: string,
  {
    cookie,
    origin,
    timeoutMs = BACKEND_REQUEST_TIMEOUT_MS,
  }: { cookie?: string; origin?: string; timeoutMs?: number },
): Promise<T> => {
  // the body read shares the signal, so it is timed with the request: a body
  // that stalls past the timeout is a timeout of the request, not a clean
  // answer the metrics would book under its status before the rejection
  // surfaces
  const body = await timedBackendRequest(
    path,
    () =>
      fetch(`${COLLABORATION_BACKEND_BASE_URL}${path}`, {
        // a backend that hangs must not hang the websocket upgrade with it.
        // The abort surfaces as an error without a `status`, which every caller
        // maps to a retryable 503 — never to a permission decision
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          // an anonymous caller may have no session at all; `cookie: undefined` would
          // reach the backend as the literal string "undefined"
          ...(cookie ? { cookie } : {}),
          // a same-origin request carries no `Origin` — forwarded when there is one, omitted
          // rather than sent empty, which is not a value the header is allowed to take
          ...(origin ? { origin } : {}),
          'X-Y-Provider-Key': Y_PROVIDER_API_KEY,
        },
      }),
    async (res) => {
      if (!res.ok) {
        const err: Error & { status?: number } = new Error(
          `Failed to fetch ${path}: ${res.status}`,
        );
        err.status = res.status;
        throw err;
      }
      return (await res.json()) as T;
    },
  );
  return body as T;
};

// The HTTP status `backendFetch` tags its rejections with, read back without
// trusting the error's runtime shape.
export const errStatus = (err: unknown): number | undefined =>
  typeof err === 'object' &&
  err !== null &&
  'status' in err &&
  typeof (err as { status: unknown }).status === 'number'
    ? (err as { status: number }).status
    : undefined;

// The backend answered "no": a verdict, not an outage.
const isRefusal = (err: unknown): boolean => {
  const status = errStatus(err);
  return status === 401 || status === 403 || status === 404;
};

// The backend did not answer at all: the caller must retry, never read a 5xx
// or a network blip as a permission decision.
const authorizationUnavailable = () =>
  apiError(503, 'Document authorization backend is unavailable');

type Caller = Pick<AppAuthInfo, 'userid' | 'cookie' | 'origin'>;

/**
 * Who the session cookie belongs to. Rejects with the backend's error, so the
 * caller tells a dead session (401/403) from an outage.
 */
export const resolveUserid = async (
  cookie: string,
  origin: string | undefined,
): Promise<string> => {
  const cached = identityCache.get(cookie);
  if (cached != null) return cached;
  const user = await backendFetch<BackendUser>('/api/v1.0/users/me/', {
    cookie,
    origin,
  });
  const userid = String(user.id);
  identityCache.set(cookie, userid);
  return userid;
};

/**
 * What the caller may do with the document. A refusal is a deny, cached like
 * any verdict — a client that lost access costs one call per TTL, not one per
 * poll. An unanswered backend is a 503 and is never cached.
 */
export const resolveAbilities = (
  yhub: YHub,
  org: string,
  docid: string,
  user: Caller | null | undefined,
): Promise<CachedAbilities> =>
  cachedAbilities(
    yhub,
    org,
    docid,
    user?.cookie,
    user?.userid ?? ANONYMOUS_USERID,
    async () => {
      try {
        return await backendFetch<BackendDocument>(
          `/api/v1.0/documents/${docid}/abilities/`,
          user ?? {},
        );
      } catch (err) {
        if (isRefusal(err)) return { abilities: { retrieve: false } };
        throw authorizationUnavailable();
      }
    },
  );

/**
 * When the caller was given access to the document — the payload
 * `resolveHistoryFrom` turns into the start of the history they may read. A
 * refusal means no access row (`null`); an unanswered backend is a 503.
 */
export const resolveAccess = (
  yhub: YHub,
  org: string,
  docid: string,
  user: Caller | null | undefined,
): Promise<AccessPayload | null> =>
  cachedAccess(yhub, org, docid, user?.userid ?? ANONYMOUS_USERID, async () => {
    try {
      const access = await backendFetch<AccessPayload>(
        `/api/v1.0/documents/${docid}/accesses/me/`,
        user ?? {},
      );
      return access ?? null;
    } catch (err) {
      if (isRefusal(err)) return null;
      throw authorizationUnavailable();
    }
  });

// Django orders the document lists by `updated_at` and no edit goes through it
// anymore, so it is told here that a document moved on.
export const touchDocument = async (docid: string): Promise<void> => {
  if (backendSigningKey == null) return;
  try {
    const path = `/api/v1.0/documents/${docid}/content-updated/`;
    const token = await getBackendToken();
    const res = await timedBackendRequest(path, () =>
      fetch(`${COLLABORATION_BACKEND_BASE_URL}${path}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(BACKEND_NOTIFY_TIMEOUT_MS),
      }),
    );
    if (!res.ok) {
      touchLog.warn(
        { docid, status: res.status },
        'backend refused the notification',
      );
    }
  } catch (err) {
    // best effort: a lost notification only leaves `updated_at` behind until
    // the document is edited again, it must never fail a compaction
    touchLog.warn({ err, docid }, 'could not notify the backend');
  }
};
