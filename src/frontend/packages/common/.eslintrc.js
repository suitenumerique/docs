module.exports = {
  root: true,
  extends: ['impress/next'],
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 'latest',
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json'],
  },
  rules: {
    '@next/next/no-html-link-for-pages': 'off',
  },
  ignorePatterns: ['node_modules'],
};
