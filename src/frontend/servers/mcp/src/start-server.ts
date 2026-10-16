import { MCP_HOST, MCP_PORT } from '@/env.js';
import { createApp } from '@/server.js';

createApp()
  .then((app) => {
    app.listen(MCP_PORT, MCP_HOST, () => {
      console.log(`docs-mcp listening on http://${MCP_HOST}:${MCP_PORT}`);
    });
  })
  .catch((error: unknown) => {
    console.error('Failed to start docs-mcp:', error);
    process.exit(1);
  });
