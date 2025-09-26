const typescriptEslint = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');
const vitest = require('@vitest/eslint-plugin');
const jest = require('eslint-plugin-jest');
const testingLibrary = require('eslint-plugin-testing-library');

const testConfig = {
  files: [
    '*.spec.*',
    '*.test.*',
    '**/__tests__/**/*',
    '**/__mock__/**/*',
    '**/__mocks__/**/*',
  ],
  languageOptions: {
    parser: typescriptParser,
    parserOptions: {
      project: true,
    },
    globals: {
      describe: 'readonly',
      it: 'readonly',
      test: 'readonly',
      expect: 'readonly',
      beforeEach: 'readonly',
      afterEach: 'readonly',
      beforeAll: 'readonly',
      afterAll: 'readonly',
      jest: 'readonly',
    },
  },
  plugins: {
    '@typescript-eslint': typescriptEslint,
    jest,
    vitest,
    'testing-library': testingLibrary,
  },
  rules: {
    '@typescript-eslint/ban-types': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-unsafe-argument': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { varsIgnorePattern: '^_', argsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/unbound-method': 'off',
    'jest/unbound-method': 'error',
    'jest/expect-expect': 'error',
    'testing-library/no-await-sync-events': [
      'error',
      { eventModules: ['fire-event'] },
    ],
    'testing-library/await-async-events': [
      'error',
      {
        eventModule: 'userEvent',
      },
    ],
    'testing-library/no-manual-cleanup': 'off',
    'react/display-name': 'off',
    'react/react-in-jsx-scope': 'off',
  },
};

module.exports = { testConfig };
