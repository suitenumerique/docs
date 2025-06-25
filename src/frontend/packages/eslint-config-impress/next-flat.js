import js from '@eslint/js';
import tanstackQuery from '@tanstack/eslint-plugin-query';
import typescript from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

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
    files: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
    plugins: {
      '@tanstack/query': tanstackQuery,
      'jsx-a11y': jsxA11y,
      import: importPlugin,
      react,
      'react-hooks': reactHooks,
    },
    settings: {
      react: {
        version: 'detect',
      },
      'jsx-a11y': {
        polymorphicPropName: 'as',
        components: {
          Input: 'input',
          Button: 'button',
          Box: 'div',
          Text: 'span',
          Select: 'select',
        },
      },
    },
    rules: {
      ...globalRules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'react/react-in-jsx-scope': 'off', // Not needed in modern React
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        console: 'readonly', 
        fetch: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        history: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        addEventListener: 'readonly',
        removeEventListener: 'readonly',
        Image: 'readonly',
        createImageBitmap: 'readonly',
        structuredClone: 'readonly',
        // Node.js globals
        process: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
        NodeJS: 'readonly',
        // React
        React: 'readonly',
        JSX: 'readonly',
      },
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
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
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
    files: ['**/*.spec.*', '**/*.test.*', '**/__mock__/**/*'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
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
      'react/display-name': 0,
      'react/react-in-jsx-scope': 'off',
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
    files: ['**/service-worker.js', '**/service-worker.ts', '**/sw.js', '**/sw.ts'],
    languageOptions: {
      globals: {
        self: 'readonly',
        caches: 'readonly',
        ServiceWorkerGlobalScope: 'readonly',
        trustedTypes: 'readonly',
        clients: 'readonly',
        registration: 'readonly',
        skipWaiting: 'readonly',
        importScripts: 'readonly',
      },
    },
  },
  {
    files: ['**/*.config.js', '**/*.config.ts', '**/next.config.js', '**/stylelint.config.js'],
    languageOptions: {
      globals: {
        module: 'readonly',
        exports: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
  },
  {
    ignores: ['node_modules/**', '.next/**', 'out/**', 'build/**'],
  },
];
