const typescriptEslint = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');

// TypeScript declaration files configuration
const declarationConfig = {
  files: ['*.d.ts'],
  rules: {
    'no-unused-vars': 'off',
  },
};

// TypeScript configuration
const typescriptConfig = {
  files: ['**/*.ts', '**/*.tsx'],
  languageOptions: {
    parser: typescriptParser,
    parserOptions: {
      project: true,
    },
  },
  plugins: {
    '@typescript-eslint': typescriptEslint,
  },
  rules: {
    '@typescript-eslint/no-inferrable-types': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/no-unnecessary-type-assertion': 'error',
    '@typescript-eslint/no-unsafe-argument': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { varsIgnorePattern: '^_', argsIgnorePattern: '^_' },
    ],
    'sort-imports': [
      'error',
      {
        ignoreDeclarationSort: true,
      },
    ],
    // Turn off base rule as it can report incorrect errors
    'no-unused-vars': 'off',
  },
};

module.exports = { declarationConfig, typescriptConfig };
