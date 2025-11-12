const path = require('path');
const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
const {
  NativeFederationTypeScriptHost,
} = require('@module-federation/native-federation-typescript/webpack');
const {
  NativeFederationTypeScriptHost: NativeFederationTypeScriptHostCore,
} = require('@module-federation/native-federation-typescript');

const moduleFederationConfig = {
  name: 'plugin_frontend',
  filename: 'remoteEntry.js',
  exposes: {
    './MyCustomComponent': './src/MyCustomComponent.tsx',
    './MyCustomHeaderMenu': './src/MyCustomHeaderMenu.tsx',
    './ThemingComponent': './src/ThemingComponent.tsx',
    './ThemingDemo': './src/ThemingDemo.tsx',
  },
  remotes: {
    impress: 'impress@http://localhost:3000/_next/static/chunks/remoteEntry.js',
  },
  shared: {
    react: { singleton: true },
    'react-dom': { singleton: true },
    'styled-components': { singleton: true },
    'react-aria-components': { singleton: true },
    '@openfun/cunningham-react': { singleton: true },
    'react-i18next': { singleton: true },
    'yjs': { singleton: true },
    '@gouvfr-lasuite/ui-kit': { singleton: true },
    'clsx': { singleton: true },
    'cmdk': { singleton: true },
    'react-intersection-observer': { singleton: true },
    '@tanstack/react-query': { singleton: true },
    'zustand': { singleton: true },
  },
};

let mfTypesReady;
const ensureFederatedTypesPlugin = {
  apply(compiler) {
    compiler.hooks.beforeCompile.tapPromise(
      'EnsureFederatedTypes',
      async () => {
        if (!mfTypesReady) {
          const downloader = NativeFederationTypeScriptHostCore.raw({
            moduleFederationConfig,
          });
          mfTypesReady = downloader.writeBundle();
        }
        await mfTypesReady;
      },
    );
  },
};

module.exports = (env, argv) => {
  const dev = argv.mode !== 'production';

  return {
    entry: './src/index.tsx',
    mode: dev ? 'development' : 'production',
    devServer: dev ? {
      port: 3002,
      hot: true,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization',
      },
    } : undefined,
    output: {
      path: path.resolve(__dirname, 'dist'),
      publicPath: dev ? 'http://localhost:3002/' : undefined,
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js', '.jsx'],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
      ],
    },
    plugins: [
      new ModuleFederationPlugin(moduleFederationConfig),
      ...(dev
        ? [
          ensureFederatedTypesPlugin,
          NativeFederationTypeScriptHost({
            moduleFederationConfig,
          }),
        ]
        : []),
    ],
  };
};
