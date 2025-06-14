// Root ESLint config for the frontend workspace
export default [
  {
    ignores: [
      'node_modules/**',
      'build/**',
      'dist/**',
      '.next/**',
      'out/**',
      // Let individual apps handle their own configs
      'apps/**',
      'packages/**',
      'servers/**',
    ],
  },
];
