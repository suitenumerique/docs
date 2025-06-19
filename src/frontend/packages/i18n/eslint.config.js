import impressJestFlat from 'eslint-config-impress/jest-flat';

export default [
  ...impressJestFlat,
  {
    ignores: ['node_modules/**'],
  },
  {
    // Node.js globals for .mjs files
    files: ['**/*.mjs', '**/*.js'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
      },
    },
  },
  {
    // Jest globals for test files
    files: ['**/*.test.js', '**/*.test.ts', '**/__tests__/**/*'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        afterAll: 'readonly',
        afterEach: 'readonly',
        jest: 'readonly',
        console: 'readonly',
      },
    },
  },
];
