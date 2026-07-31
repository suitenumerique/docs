import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import createDocument from './tools/createDocument.js';
import readDocument from './tools/readDocument.js';
import searchDocuments from './tools/searchDocuments.js';
import type { ToolExtra, ToolModule } from './tools/types.js';

const tools: ToolModule[] = [searchDocuments, readDocument, createDocument];

/** Reject a tool call whose token doesn't carry the scope that tool requires. */
function withScopeCheck(
  tool: ToolModule,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): (args: any, extra: ToolExtra) => Promise<CallToolResult> {
  return async (args, extra) => {
    if (!extra.authInfo?.scopes.includes(tool.requiredScope)) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Missing required scope "${tool.requiredScope}" for tool "${tool.name}".`,
          },
        ],
      };
    }

    return tool.handler(args, extra);
  };
}

/** Builds a fresh `docs-mcp` server instance (stateless: one per request). */
export function buildServer(): McpServer {
  const server = new McpServer({ name: 'docs-mcp', version: '0.1.0' });

  for (const tool of tools) {
    server.registerTool(tool.name, tool.config, withScopeCheck(tool));
  }

  return server;
}
