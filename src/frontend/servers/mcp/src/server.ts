import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { getOAuthProtectedResourceMetadataUrl } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';

import { KeycloakJwtVerifier } from '@/auth/jwtVerifier.js';
import { MCP_RESOURCE_URL } from '@/env.js';
import { buildServer } from '@/mcp/buildServer.js';
import { buildProtectedResourceMetadataRouter } from '@/prm.js';

export async function createApp(): Promise<express.Express> {
  const app = express();
  app.use(express.json());

  app.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use(await buildProtectedResourceMetadataRouter());

  const verifier = new KeycloakJwtVerifier();
  const mcpAuth = requireBearerAuth({
    verifier,
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(
      new URL(MCP_RESOURCE_URL),
    ),
  });

  // Stateless mode: a fresh McpServer + transport per request, so concurrent requests from
  // different clients never share JSON-RPC request IDs or in-memory session state.
  app.all('/mcp', mcpAuth, async (req, res) => {
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on('close', () => {
      void transport.close();
      void server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  return app;
}
