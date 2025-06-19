import js from '@eslint/js';
import tsEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import playwright from 'eslint-plugin-playwright';

export default [
  // Base JavaScript config
  js.configs.recommended,
  
  // TypeScript configuration
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': tsEslint,
    },
    rules: {
      ...tsEslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      'no-console': 'off',
    },
  },

  // Playwright test configuration
  {
    files: ['**/*.spec.ts', '**/*.test.ts', '__tests__/**/*.ts'],
    plugins: {
      playwright,
    },
    rules: {
      ...playwright.configs.recommended.rules,
      'playwright/no-skipped-test': 'warn',
      'playwright/no-conditional-expect': 'warn',
      'playwright/no-conditional-in-test': 'warn',
      'playwright/no-wait-for-timeout': 'warn',
      'playwright/expect-expect': 'warn',
      'playwright/no-networkidle': 'warn',
      'playwright/no-force-option': 'warn',
    },
  },

  // Global configuration for all files
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Node.js globals
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        NodeJS: 'readonly',
        // Browser globals that might be accessed in tests
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
      'no-unsafe-optional-chaining': 'warn',
    },
  },

  // Ignore patterns
  {
    ignores: [
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
      'screenshots/**',
      'report/**',
      'save/**',
      '*.log',
      '**/*.min.js',
    ],
  },
];
