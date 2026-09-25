/** Environment configuration for docs-mcp, validated at startup (fail fast). */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/** Parses a comma- and/or whitespace-separated list, dropping empty entries. */
function list(value: string | undefined): string[] {
  return (value ?? '').split(/[\s,]+/).filter(Boolean);
}

export const MCP_HOST = process.env.MCP_HOST || '0.0.0.0';
export const MCP_PORT = Number(process.env.MCP_PORT || 4455);

/** Canonical URL of this MCP server's /mcp endpoint, used as the OAuth "resource". */
export const MCP_RESOURCE_URL = required('MCP_RESOURCE_URL');

/**
 * OIDC provider (authorization server) the access tokens come from. Any provider issuing
 * signed JWT access tokens works; Keycloak (docker/auth/realm.json) is only the dev example.
 *
 * MCP_OIDC_ISSUER is the issuer as seen by end users/clients, e.g.
 * http://localhost:8083/realms/impress in dev. It is used only to validate the `iss` claim and
 * is never called over the network directly: the *_URL variables below are the endpoints this
 * server actually fetches, which may use a different (internal) hostname, e.g. in Docker.
 *
 * Deliberately MCP_-prefixed rather than bare OIDC_*: the backend already reads a large
 * OIDC_OP_* / OIDC_RS_* family, and near-identical names with different meanings (e.g.
 * OIDC_JWKS_URL vs OIDC_OP_JWKS_ENDPOINT) would be easy to mix up in a shared deployment config.
 */
export const MCP_OIDC_ISSUER = required('MCP_OIDC_ISSUER');
export const MCP_OIDC_JWKS_URL = required('MCP_OIDC_JWKS_URL');
export const MCP_OIDC_DISCOVERY_URL = required('MCP_OIDC_DISCOVERY_URL');

export const DOCS_API_URL = required('DOCS_API_URL');

/**
 * Which access-token claim must identify this server, and which values are accepted — the
 * counterpart of the backend's OIDC_RS_AUDIENCE_CLAIM / OIDC_RS_ALLOWED_AUDIENCES.
 *
 * - `aud` (default, RFC 9068): the token must be issued *for* this server, e.g.
 *   MCP_ALLOWED_AUDIENCES=docs-mcp with Keycloak's audience mapper, or this server's
 *   MCP_RESOURCE_URL with an authorization server honouring RFC 8707 resource indicators.
 * - any other claim, typically `client_id` or `azp`: for providers that cannot add a custom
 *   audience, the token's origin client must be allow-listed instead.
 *
 * There is no way to disable the check: at least one allowed value is required.
 */
export const MCP_AUDIENCE_CLAIM = process.env.MCP_AUDIENCE_CLAIM || 'aud';
export const MCP_ALLOWED_AUDIENCES = list(required('MCP_ALLOWED_AUDIENCES'));
if (MCP_ALLOWED_AUDIENCES.length === 0) {
  throw new Error('MCP_ALLOWED_AUDIENCES must list at least one value');
}

/**
 * Extra scopes advertised in the protected resource metadata, on top of the per-tool
 * docs:documents:* scopes — e.g. a provider-specific scope that makes it add the audience
 * (`docs-mcp` with the dev Keycloak realm). Empty by default.
 */
export const MCP_EXTRA_SCOPES = list(process.env.MCP_EXTRA_SCOPES);
