import { defineConfig } from '@eslint/config-helpers';
import docsPlugin from 'eslint-plugin-docs';

const eslintConfig = defineConfig([
  {
    ignores: ['dist/**'],
  },
  {
    files: ['**/*.mjs', '**/*.ts', '**/*.tsx'],
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
    rules: {
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
]);

export default eslintConfig;
