/**
 * OAuth Protected Resource Metadata (RFC 9728).
 *
 * This is how an MCP client discovers *which* authorization server to use and *which* scopes
 * to request before it ever talks to the OIDC provider: it fetches
 * `/.well-known/oauth-protected-resource` from this server, learns the issuer and supported
 * scopes, then drives the Authorization Code + PKCE flow against the provider itself.
 *
 * We reuse the provider's own OIDC discovery document as the `oauthMetadata` the SDK's helper
 * expects, rather than hand-rolling one.
 */

import { mcpAuthMetadataRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import type { OAuthMetadata } from '@modelcontextprotocol/sdk/shared/auth.js';
import axios from 'axios';
import type { Router } from 'express';

import {
  MCP_EXTRA_SCOPES,
  MCP_OIDC_DISCOVERY_URL,
  MCP_RESOURCE_URL,
} from '@/env.js';

/** Scopes the tools check (see src/mcp/tools/); Django requires them too (OIDC_RS_SCOPES). */
const TOOL_SCOPES = [
  'docs:documents:search',
  'docs:documents:read',
  'docs:documents:create',
];

export async function buildProtectedResourceMetadataRouter(): Promise<Router> {
  const { data: oauthMetadata } = await axios.get<OAuthMetadata>(
    MCP_OIDC_DISCOVERY_URL,
  );

  return mcpAuthMetadataRouter({
    oauthMetadata,
    resourceServerUrl: new URL(MCP_RESOURCE_URL),
    resourceName: 'docs-mcp',
    scopesSupported: [...new Set([...TOOL_SCOPES, ...MCP_EXTRA_SCOPES])],
  });
}
