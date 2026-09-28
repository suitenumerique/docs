/**
 * Validates MCP access tokens issued by the configured OIDC provider.
 *
 * This implements the MCP SDK's `OAuthTokenVerifier` interface: given a raw bearer token, it
 * must either return `AuthInfo` (signature, issuer, expiry, audience and subject all valid) or
 * throw, in which case the SDK's `requireBearerAuth` middleware turns that into an HTTP 401.
 *
 * Tokens must be signed JWTs: we validate them against the provider's JWKS rather than trusting
 * an unsigned token, and we require the configured audience claim explicitly (see
 * `MCP_AUDIENCE_CLAIM` in `env.ts`), so that a token minted for another application of the same
 * provider is rejected here, before it is ever forwarded to Django. With the dev Keycloak realm
 * that is `aud=docs-mcp`, which Keycloak only adds when the `docs-mcp` optional client scope
 * was requested (see docker/auth/realm.json).
 *
 * Any error we don't recognize as InvalidTokenError gets swallowed by the SDK's bearerAuth
 * middleware into a generic, unlogged 500 — so we log (never the token itself) before
 * re-throwing as InvalidTokenError, to keep the real reason visible in this server's logs.
 */

import { InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import type { OAuthTokenVerifier } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { type JWTPayload, type JWTVerifyGetKey, jwtVerify } from 'jose';

export type OidcJwtVerifierOptions = {
  /** Expected `iss` claim. */
  issuer: string;
  /** Key resolver for signature checks, e.g. `createRemoteJWKSet(jwksUrl)`. */
  jwks: JWTVerifyGetKey;
  /** Claim identifying this server: `aud` (default), `client_id`, `azp`, ... */
  audienceClaim: string;
  /** Accepted values for `audienceClaim`; the token must carry at least one of them. */
  allowedAudiences: readonly string[];
};

function claimValues(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  return [];
}

export class OidcJwtVerifier implements OAuthTokenVerifier {
  constructor(private readonly options: OidcJwtVerifierOptions) {
    if (options.allowedAudiences.length === 0) {
      throw new Error('OidcJwtVerifier requires at least one allowed audience');
    }
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const { issuer, jwks, audienceClaim, allowedAudiences } = this.options;

    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, jwks, {
        issuer,
        // jose handles the standard `aud` claim itself, string or array alike.
        audience: audienceClaim === 'aud' ? [...allowedAudiences] : undefined,
      }));
    } catch (error) {
      console.error('JWT verification failed:', error);
      throw new InvalidTokenError(
        error instanceof Error ? error.message : 'Token verification failed',
      );
    }

    if (audienceClaim !== 'aud') {
      const values = claimValues(payload[audienceClaim]);
      if (values.length === 0) {
        console.error(
          `JWT verification failed: missing ${audienceClaim} claim`,
        );
        throw new InvalidTokenError(`Token has no ${audienceClaim} claim`);
      }
      if (!values.some((value) => allowedAudiences.includes(value))) {
        console.error(
          `JWT verification failed: unexpected ${audienceClaim} claim value`,
        );
        throw new InvalidTokenError(
          `Token ${audienceClaim} claim is not an allowed audience`,
        );
      }
    }

    if (typeof payload.sub !== 'string') {
      throw new InvalidTokenError('Token has no subject (sub) claim');
    }

    const scope = typeof payload.scope === 'string' ? payload.scope : '';

    return {
      token,
      clientId:
        (typeof payload.azp === 'string' && payload.azp) ||
        (typeof payload.client_id === 'string' && payload.client_id) ||
        'unknown',
      scopes: scope.split(' ').filter(Boolean),
      expiresAt: typeof payload.exp === 'number' ? payload.exp : undefined,
      extra: { sub: payload.sub },
    };
  }
}
