import { randomBytes } from 'crypto';

import { AUTH_TOKEN_TTL_MS } from '@/env';

/**
 * Claims handed from the gateway to the embedded @y/hub server. `userid` is
 * required by @y/hub (used for content attributions); `room` binds the token
 * to a single document.
 */
export interface TokenClaims {
  userid: string;
  room: string;
  canEdit: boolean;
}

const tokens = new Map<string, { claims: TokenClaims; expiresAt: number }>();

const SWEEP_INTERVAL_MS = 30_000;
setInterval(() => sweepExpiredTokens(), SWEEP_INTERVAL_MS).unref();

export const sweepExpiredTokens = (now = Date.now()) => {
  for (const [token, entry] of tokens) {
    if (entry.expiresAt < now) {
      tokens.delete(token);
    }
  }
};

export const issueToken = (claims: TokenClaims): string => {
  const token = randomBytes(32).toString('base64url');
  tokens.set(token, { claims, expiresAt: Date.now() + AUTH_TOKEN_TTL_MS });
  return token;
};

/**
 * Single use: the token is deleted on first read. The lookup is synchronous
 * on purpose — it lets the @y/hub auth plugin satisfy the uws constraint of
 * reading the request before any await.
 */
export const consumeToken = (token: string): TokenClaims | null => {
  const entry = tokens.get(token);
  if (!entry) {
    return null;
  }
  tokens.delete(token);
  if (entry.expiresAt < Date.now()) {
    return null;
  }
  return entry.claims;
};
