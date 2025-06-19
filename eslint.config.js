// Root-level ESLint configuration for the monorepo
// Individual apps should have their own eslint.config.js files

export default [
  // Global ignores for the entire monorepo
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.next/**',
      '**/out/**',
      '**/public/**',
      '**/static/**',
      '**/*.min.js',
      '**/bundle*.js',
      '**/vendor/**',
      '**/test-results/**',
      '**/playwright-report/**',
      '**/screenshots/**',
      '**/report/**',
      '**/save/**',
      '**/yarn-error.log',
      '**/data/**',
      '**/docs/**',
      '**/docker/**',
      '**/env.d/**',
      '**/gitlint/**',
      '**/helm/**',
      '**/crowdin/**',
      '**/bin/**',
    ],
  },
];
