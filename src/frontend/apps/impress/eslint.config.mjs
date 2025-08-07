import { defineConfig } from '@eslint/config-helpers';
import docsPlugin from 'eslint-plugin-docs';

const eslintConfig = defineConfig([
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
