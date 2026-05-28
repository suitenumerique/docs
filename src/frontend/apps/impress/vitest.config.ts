/// <reference types="vitest" />
import path from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    coverage: {
      provider: 'v8',
    },
  },
  define: {
    'process.env.NODE_ENV': 'test',
  },
  resolve: {
    alias: [
      {
        find: /^.*\.svg$/,
        replacement: path.resolve(__dirname, 'src/tests/__mocks__/svgMock.tsx'),
      },
    ],
    tsconfigPaths: true,
  },
});
