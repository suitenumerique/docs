const typescriptEslint = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');
const playwright = require('eslint-plugin-playwright');

const playwrightConfig = {
  plugins: {
    '@typescript-eslint': typescriptEslint,
    playwright,
  },
  languageOptions: {
    parser: typescriptParser,
    parserOptions: {
      project: true,
    },
  },
  files: [
    '**/*.spec.ts',
    '**/*.test.ts',
    '**/__mock__/**/*',
    '**/auth.setup.ts',
  ],
  rules: {
    ...playwright.configs['flat/recommended'].rules,
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-unsafe-argument': 'off',
    'playwright/no-force-option': 'off',
    'playwright/no-wait-for-timeout': 'off',
    'playwright/no-conditional-in-test': 'off',
    'playwright/no-skipped-test': 'off',
    'playwright/expect-expect': 'error',
    'playwright/no-conditional-expect': 'error',
  },
};

module.exports = { playwrightConfig };
