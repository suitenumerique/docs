import { defineConfig } from '@eslint/config-helpers';
import docsPlugin from 'eslint-plugin-docs';

const eslintConfig = defineConfig([
  {
    ignores: [
      '.next/**',
      'out/**',
      'public/service-worker.js',
      // Verbatim vendored copy of the encryption service's generated SDK
      // declaration, never hand-edited, so never linted.
      'src/features/docs/doc-collaboration/vault/client-sdk.d.ts',
    ],
  },
  {
    plugins: {
      docs: docsPlugin,
    },
    extends: ['docs/next'],
    settings: {
      next: {
        rootDir: import.meta.dirname,
      },
    },
  },
]);

export default eslintConfig;
