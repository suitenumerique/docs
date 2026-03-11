import { defineConfig } from '@eslint/config-helpers';
import docsPlugin from 'eslint-plugin-docs';

const eslintConfig = defineConfig([
  {
    files: ['**/*.ts', '**/*.mjs'],
    plugins: {
      docs: docsPlugin,
    },
    extends: ['docs/playwright'],
  },
]);

export default eslintConfig;
