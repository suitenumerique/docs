import { defineConfig } from '@eslint/config-helpers';
import docsPlugin from 'eslint-plugin-docs';

const eslintConfig = defineConfig([
  {
    files: ['**/*.ts', '**/*.mjs'],
    plugins: {
      docs: docsPlugin,
    },
    extends: ['docs/playwright'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        project: ['./tsconfig.json'],
      },
    },
  },
]);

export default eslintConfig;
