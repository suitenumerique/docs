import { defineConfig } from '@eslint/config-helpers';
import docsPlugin from 'eslint-plugin-docs';

const eslintConfig = defineConfig([
  {
    ignores: ['.next/**', 'out/**', 'public/service-worker.js'],
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
