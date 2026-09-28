import { defineConfig } from '@eslint/config-helpers';
import docsPlugin from 'eslint-plugin-docs';

const eslintConfig = defineConfig([
  {
    files: ['**/*.ts', '**/*.mjs', '**/*.js'],
    plugins: {
      docs: docsPlugin,
    },
    extends: ['docs/next', 'docs/test'],
  },
]);

export default eslintConfig;
