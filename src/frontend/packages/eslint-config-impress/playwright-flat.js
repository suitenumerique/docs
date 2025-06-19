import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import typescript from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import playwright from 'eslint-plugin-playwright';
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
  prettier,
  {
    files: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
    plugins: {
      '@next/next': nextPlugin,
      import: importPlugin,
      react,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...globalRules,
      '@next/next/no-html-link-for-pages': 'off',
    },
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
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
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
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
  {
    files: ['**/*.spec.*', '**/*.test.*', '**/__mock__/**/*'],
    plugins: {
      playwright,
    },
    rules: {
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: ['**/*.d.ts'],
    rules: {
      'no-unused-vars': 'off',
    },
  },
  {
    ignores: ['node_modules/**'],
  },
];
