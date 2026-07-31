import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type {
  CallToolResult,
  ServerNotification,
  ServerRequest,
} from '@modelcontextprotocol/sdk/types.js';
import type { ZodRawShape } from 'zod';

export type ToolExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

export type ToolModule = {
  name: string;
  config: {
    title: string;
    description: string;
    inputSchema: ZodRawShape;
  };
  /** OAuth scope required to call this tool (checked before it ever reaches Django). */
  requiredScope: string;
  // Args are validated against `config.inputSchema` by the MCP SDK before this runs.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (args: any, extra: ToolExtra) => Promise<CallToolResult>;
};
