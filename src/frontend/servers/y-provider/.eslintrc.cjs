module.exports = {
  root: true,
  extends: ['impress/jest', 'impress/next'],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json'],
  },
  settings: {
    next: {
      rootDir: __dirname,
    },
  },
  rules: {
    '@next/next/no-html-link-for-pages': 'off',
  },
  ignorePatterns: ['node_modules'],
};
