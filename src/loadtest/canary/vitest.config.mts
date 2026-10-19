import { defineConfig } from 'vitest/config';

// `__tests__/*.spec.ts`: unit tests of the pure parts, and one integration test
// running a swarm against an in-process y-websocket server (`_server.ts`).
export default defineConfig({
  test: {
    include: ['__tests__/**/*.spec.ts'],
    testTimeout: 30000,
    clearMocks: true,
  },
});
