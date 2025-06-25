import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import react from 'eslint-plugin-react';

const globalRules = {
  'block-scoped-var': 'error',
  curly: ['error', 'all'],
  'import/no-duplicates': ['error', { considerQueryString: false }],
  'import/order': [
    'error',
    {
      alphabetize: {
        order: 'asc',
      },
      groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
      pathGroups: [
        {
          pattern: '@/**',
          group: 'internal',
        },
      ],
      pathGroupsExcludedImportTypes: ['builtin'],
      'newlines-between': 'always',
      warnOnUnassignedImports: true,
    },
  ],
  'no-alert': 'error',
  'no-unused-vars': [
    'error',
    { varsIgnorePattern: '^_', argsIgnorePattern: '^_' },
  ],
  'no-var': 'error',
  'react/jsx-curly-brace-presence': [
    'error',
    { props: 'never', children: 'never', propElementValues: 'always' },
  ],
  'sort-imports': [
    'error',
    {
      ignoreDeclarationSort: true,
    },
  ],
};

export default [
  js.configs.recommended,
  prettierConfig,
  {
    files: ['**/*.js', '**/*.jsx'],
    plugins: {
      import: importPlugin,
      react,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: globalRules,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      '@typescript-eslint': typescript,
      import: importPlugin,
      react,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      ...globalRules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { varsIgnorePattern: '^_', argsIgnorePattern: '^_' },
      ],
      'no-unused-vars': 'off', // Turn off base rule as it conflicts with TypeScript rule
    },
  },
  {
    files: ['**/*.d.ts'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    files: ['**/*.cjs', '*.cjs', '.eslintrc.js', 'common.js', 'jest.js', 'next.js', 'playwright.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
    rules: {
      ...globalRules,
      'import/no-duplicates': 'off', // Turn off for CommonJS files as they may not support ES6 imports
      'import/order': 'off',
    },
  },
  {
    ignores: ['node_modules/**'],
  },
];
