const { baseConfig } = require('./base');
const pkg = require('./package.json');
const { playwrightConfig } = require('./playwright');
const { testConfig } = require('./test');
const { typescriptConfig, declarationConfig } = require('./typescript');

const plugin = {
  meta: {
    name: pkg.name,
    version: pkg.version,
    namespace: 'docs',
  },
  configs: {},
};

Object.assign(plugin.configs, {
  base: [baseConfig],
  next: [baseConfig, typescriptConfig, declarationConfig, testConfig],
  test: [testConfig],
  playwright: [
    baseConfig,
    typescriptConfig,
    declarationConfig,
    playwrightConfig,
  ],
});

module.exports = plugin;
