/**
 * Validates Keycloak-issued MCP access tokens.
 *
 * This implements the MCP SDK's `OAuthTokenVerifier` interface: given a raw bearer token, it
 * must either return `AuthInfo` (signature, issuer, expiry, audience and subject all valid) or
 * throw, in which case the SDK's `requireBearerAuth` middleware turns that into an HTTP 401.
 *
 * We validate against Keycloak's realm JWKS (fetched via OIDC discovery) rather than trusting
 * an unsigned token, and we require the `docs-mcp` audience explicitly: Keycloak only adds it
 * when the `docs-mcp` optional client scope was requested (see docker/auth/realm.json), so its
 * presence proves the client asked for an MCP-scoped token, not just any Keycloak token.
 *
 * Any error we don't recognize as InvalidTokenError gets swallowed by the SDK's bearerAuth
 * middleware into a generic, unlogged 500 — so we log (never the token itself) before
 * re-throwing as InvalidTokenError, to keep the real reason visible in this server's logs.
 */

import { InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import type { OAuthTokenVerifier } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { type JWTPayload, createRemoteJWKSet, jwtVerify } from 'jose';

import { KEYCLOAK_ISSUER, KEYCLOAK_JWKS_URL, MCP_AUDIENCE } from '@/env.js';

const jwks = createRemoteJWKSet(new URL(KEYCLOAK_JWKS_URL));

export class KeycloakJwtVerifier implements OAuthTokenVerifier {
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, jwks, {
        issuer: KEYCLOAK_ISSUER,
        audience: MCP_AUDIENCE,
      }));
    } catch (error) {
      console.error('JWT verification failed:', error);
      throw new InvalidTokenError(
        error instanceof Error ? error.message : 'Token verification failed',
      );
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
