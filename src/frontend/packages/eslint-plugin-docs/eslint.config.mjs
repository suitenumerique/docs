import { defineConfig } from '@eslint/config-helpers';
import docsPlugin from 'eslint-plugin-docs';

const eslintConfig = defineConfig([
  {
    files: ['**/*.js', '**/*.mjs'],
    plugins: {
      docs: docsPlugin,
    },
    extends: ['docs/base'],
    rules: {
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
]);

export default eslintConfig;
