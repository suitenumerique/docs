import {
  SignJWT,
  calculateJwkThumbprint,
  exportJWK,
  generateKeyPair,
} from 'jose';
import { vi } from 'vitest';

import { JWT_ALGORITHM } from '@/middlewares';

const { privateKey, publicKey } = await generateKeyPair(JWT_ALGORITHM, {
  extractable: true,
});
const publicJwk = await exportJWK(publicKey);
const kid = await calculateJwkThumbprint(publicJwk);

/** JWKS document shaped like the one Django's JWKSView publishes. */
export const JWKS = {
  keys: [{ ...publicJwk, kid, alg: JWT_ALGORITHM, use: 'sig' }],
};

/** Sign a token the way Django's JWTService would, for tests only. */
export const signToken = (claims: Record<string, unknown>) =>
  new SignJWT(claims)
    .setProtectedHeader({ alg: JWT_ALGORITHM, kid })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);

export const signAdminToken = () =>
  signToken({ admin: true, aud: 'y-converter' });

/** An admin token correctly signed but scoped to another service's audience. */
export const signAdminTokenForAudience = (aud: string) =>
  signToken({ admin: true, aud });

/** An admin token signed correctly but already past its expiry. */
export const signExpiredAdminToken = () =>
  new SignJWT({ admin: true })
    .setProtectedHeader({ alg: JWT_ALGORITHM, kid })
    .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
    .sign(privateKey);

// A second, unrelated key pair: never published in the test JWKS, so a token
// signed with it must fail signature verification.
const { privateKey: roguePrivateKey } = await generateKeyPair(JWT_ALGORITHM, {
  extractable: true,
});

/**
 * An admin token carrying the real "kid" (so key lookup succeeds) but signed
 * with a key that isn't the one published in the JWKS.
 */
export const signAdminTokenWithWrongKey = () =>
  new SignJWT({ admin: true })
    .setProtectedHeader({ alg: JWT_ALGORITHM, kid })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(roguePrivateKey);

/**
 * Stub global fetch so jose's createRemoteJWKSet resolves our test JWKS
 * instead of making a real network call to the Django backend. The real
 * "jose" verification code still runs against a real signed token.
 */
export const mockJwksEndpoint = (jwksUrl: string) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      if (input.toString() !== jwksUrl) {
        throw new Error(`Unexpected fetch to ${input.toString()}`);
      }
      return new Response(JSON.stringify(JWKS), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
};
