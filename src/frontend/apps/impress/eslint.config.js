import impressNextFlat from 'eslint-config-impress/next-flat';
import jest from 'eslint-plugin-jest';

export default [
  ...impressNextFlat,
  {
    ignores: ['node_modules/**', '.eslintrc.js', 'service-worker.js', '.next/**', 'out/**', 'build/**'],
  },
  {
    // Additional browser and DOM globals for Next.js app
    files: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
    languageOptions: {
      globals: {
        // DOM and HTML globals
        HTMLElement: 'readonly',
        HTMLDivElement: 'readonly',
        SVGSVGElement: 'readonly',
        Event: 'readonly',
        KeyboardEvent: 'readonly',
        MessageEvent: 'readonly',
        
        // Web APIs
        Request: 'readonly',
        Response: 'readonly',
        RequestInit: 'readonly',
        Headers: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FormData: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        TextDecoder: 'readonly',
        TextEncoder: 'readonly',
        DOMParser: 'readonly',
        IntersectionObserver: 'readonly',
        
        // Service Worker globals
        ServiceWorkerGlobalScope: 'readonly',
        BodyInit: 'readonly',
        self: 'readonly',
      },
    },
    rules: {
      // Allow some flexibility for escape characters in regex
      'no-useless-escape': 'warn',
      // Allow redeclaring for legitimate cases
      'no-redeclare': 'warn',
    },
  },
  {
    // Jest configuration for test files
    files: ['**/*.test.js', '**/*.test.ts', '**/*.test.tsx', '**/__tests__/**/*'],
    plugins: {
      jest,
    },
    languageOptions: {
      globals: {
        ...jest.environments.globals.globals,
      },
    },
    rules: {
      ...jest.configs.recommended.rules,
      'jest/no-conditional-expect': 'warn',
    },
  },
];
