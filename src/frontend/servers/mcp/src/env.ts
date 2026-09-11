/** Environment configuration for docs-mcp, validated at startup (fail fast). */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const MCP_HOST = process.env.MCP_HOST || '0.0.0.0';
export const MCP_PORT = Number(process.env.MCP_PORT || 4455);

/** Canonical URL of this MCP server's /mcp endpoint, used as the OAuth "resource". */
export const MCP_RESOURCE_URL = required('MCP_RESOURCE_URL');

/**
 * Keycloak realm issuer as seen by end users/clients, e.g. http://localhost:8083/realms/impress.
 * Used only to validate the `iss` claim and to advertise metadata; never called over the
 * network directly (see KEYCLOAK_*_URL below for the network-reachable endpoints), since in
 * Docker this server reaches Keycloak through an internal alias, not through localhost.
 */
export const KEYCLOAK_ISSUER = required('KEYCLOAK_ISSUER');
export const KEYCLOAK_JWKS_URL = required('KEYCLOAK_JWKS_URL');
export const KEYCLOAK_DISCOVERY_URL = required('KEYCLOAK_DISCOVERY_URL');

export const DOCS_API_URL = required('DOCS_API_URL');

/**
 * Audience this server itself must find on incoming MCP access tokens. Keycloak only adds it
 * when the `docs-mcp` optional client scope was requested (see docker/auth/realm.json), so its
 * presence proves the client asked for an MCP-scoped token, not just any Keycloak token.
 */
export const MCP_AUDIENCE = process.env.MCP_AUDIENCE || 'docs-mcp';
