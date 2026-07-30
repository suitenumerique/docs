import { defineConfig } from '@eslint/config-helpers';
import docsPlugin from 'eslint-plugin-docs';

const eslintConfig = defineConfig([
  {
    // Verbatim vendored copy of the encryption service's generated SDK
    // declaration — never hand-edited, so never linted.
    ignores: ['src/features/docs/doc-collaboration/vault/client-sdk.d.ts'],
  },
  {
    plugins: {
      docs: docsPlugin,
    },
    extends: ['docs/next'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        project: ['./tsconfig.json'],
      },
    },
    settings: {
      next: {
        rootDir: import.meta.dirname,
      },
    },
  },
]);

export default eslintConfig;
