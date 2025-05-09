module.exports = {
  root: true,
  extends: ['impress/playwright'],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json'],
  },
  ignorePatterns: ['node_modules'],
};
