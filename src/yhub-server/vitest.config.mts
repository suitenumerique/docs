import { defineConfig } from 'vitest/config';

// The unit suite. `permissions.test.js` stays on node's own test runner
// (`npm test` runs it first) — it reaches into `@y/hub`'s internals by path and
// is deliberately kept to plain `node:test`. Everything vitest runs lives in
// `__tests__/*.spec.mjs`, so the two runners never fight over the same file.
export default defineConfig({
  test: {
    include: ['__tests__/**/*.spec.mjs'],
    // migration.js reads SOFT_MIGRATION and the LEGACY_S3_* variables at import
    // time and builds (or refuses to build) its S3 client from them. The specs
    // that need a live client set the variables themselves before importing the
    // module; this is only the floor, so an unset environment cannot make the
    // module throw on load in the specs that mock it instead.
    env: {
      SOFT_MIGRATION: 'false',
    },
    // each spec file resets modules and re-imports with its own environment
    isolate: true,
    clearMocks: true,
  },
});
