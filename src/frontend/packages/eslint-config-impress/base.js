import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';
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
  prettier,
  {
    files: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
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
      ...globalRules,
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
