/**
 * Everything this server sends to the Docs Django backend, and the keys both
 * ends verify each other with.
 *
 *   `backendFetch` — a GET carrying the caller's session (the auth plugin reads
 *     `/users/me/` and `/documents/{id}/` through it)
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

import { logger } from '@y/hub';
import type { JWK } from 'jose';
import {
  calculateJwkThumbprint,
  createRemoteJWKSet,
  exportJWK,
  importPKCS8,
  SignJWT,
} from 'jose';

import type { DocumentAbilities } from './permissions.js';
import {
  BACKEND_AUDIENCE,
  BACKEND_NOTIFY_TIMEOUT_MS,
  BACKEND_TOKEN_LIFETIME_S,
  BACKEND_TOKEN_MARGIN_MS,
  COLLABORATION_BACKEND_BASE_URL,
  Y_PROVIDER_API_KEY,
  YHUB_JWT_PRIVATE_KEY,
} from './config.js';

// The shape of the backend payload a caller name resolves to.
export interface BackendUser {
  id: string | number;
}
// `GET /api/v1.0/documents/{id}/` — only the abilities the policy reads.
export interface BackendDocument {
  abilities?: DocumentAbilities;
}

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
  { cookie, origin }: { cookie?: string; origin?: string },
): Promise<T> => {
  const res = await fetch(`${COLLABORATION_BACKEND_BASE_URL}${path}`, {
    headers: {
      // an anonymous caller may have no session at all; `cookie: undefined` would
      // reach the backend as the literal string "undefined"
      ...(cookie ? { cookie } : {}),
      // a same-origin request carries no `Origin` — forwarded when there is one, omitted
      // rather than sent empty, which is not a value the header is allowed to take
      ...(origin ? { origin } : {}),
      'X-Y-Provider-Key': Y_PROVIDER_API_KEY,
    },
  });
  if (!res.ok) {
    const err: Error & { status?: number } = new Error(
      `Failed to fetch ${path}: ${res.status}`,
    );
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
};

// Django orders the document lists by `updated_at` and no edit goes through it
// anymore, so it is told here that a document moved on.
export const touchDocument = async (docid: string): Promise<void> => {
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
