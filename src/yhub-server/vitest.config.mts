import { defineConfig } from 'vitest/config';

// The unit suite: `__tests__/*.spec.ts`, none of which needs redis, postgres or
// S3 — `@y/hub`, its S3 plugin and the AWS SDK are faked, `@y/y` is real.
export default defineConfig({
  test: {
    include: ['__tests__/**/*.spec.ts'],
    // migration.ts reads SOFT_MIGRATION and the LEGACY_S3_* variables at import
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
