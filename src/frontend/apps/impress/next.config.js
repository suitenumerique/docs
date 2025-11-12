const crypto = require('crypto');
const path = require('path');

const {
  NativeFederationTypeScriptRemote,
} = require('@module-federation/native-federation-typescript/webpack');
const { NextFederationPlugin } = require('@module-federation/nextjs-mf');
const CopyPlugin = require('copy-webpack-plugin');
const { InjectManifest } = require('workbox-webpack-plugin');

const { moduleFederationConfig } = require('./mf.config.js');

const buildId = crypto.randomBytes(256).toString('hex').slice(0, 8);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  compiler: {
    // Enables the styled-components SWC transform
    styledComponents: true,
  },
  generateBuildId: () => buildId,
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
  webpack(config, { isServer, dev }) {
    // Prevent rebuild loops by ignoring node_modules and generated types/outputs
    config.watchOptions = {
      ignored: [
        '**/node_modules/**',
        '**/.next/**',
        '**/dist/**',
        '**/@mf-types/**',
        '**/@mf-types.zip',
      ],
    };

    // Grab the existing rule that handles SVG imports
    const fileLoaderRule = config.module.rules.find((rule) =>
      rule.test?.test?.('.svg'),
    );

    config.module.rules.push(
      // Reapply the existing rule, but only for svg imports ending in ?url
      {
        ...fileLoaderRule,
        test: /\.svg$/i,
        resourceQuery: /url/, // *.svg?url
      },
      // Convert all other *.svg imports to React components
      {
        test: /\.svg$/i,
        issuer: fileLoaderRule.issuer,
        resourceQuery: { not: [...fileLoaderRule.resourceQuery.not, /url/] }, // exclude if *.svg?url
        use: ['@svgr/webpack'],
      },
    );

    // Copy necessary fonts from node_modules to public directory during build or dev
    config.plugins.push(
      new CopyPlugin({
        patterns: [
          {
            from: path.resolve(
              __dirname,
              '../../node_modules/emoji-datasource-apple/img/apple/64',
            ),
            to: path.resolve(__dirname, 'public/assets/fonts/emoji'),
            force: true,
          },
          {
            from: path.resolve(
              __dirname,
              '../../node_modules/@gouvfr-lasuite/ui-kit/dist/assets/fonts/Marianne',
            ),
            to: path.resolve(__dirname, 'public/assets/fonts/Marianne'),
            force: true,
          },
        ],
      }),
    );

    if (!isServer) {
      // Host configuration for Module Federation (PluginSystem)
      config.plugins.push(new NextFederationPlugin(moduleFederationConfig));
      if (dev && process.env.NEXT_PUBLIC_DEVELOP_PLUGINS === 'true') {
        console.log('[DEBUG] moduleFederationConfig:');
        console.log(moduleFederationConfig);

        config.plugins.push(
          // Allow the plugin to get types/intellisense from the host at development time
          NativeFederationTypeScriptRemote({
            moduleFederationConfig,
          }),
        );

        // Copy the generated @mf-types.zip to .next/static/chunks so it's served at /_next/static/chunks/
        const mfTypesSource = path.resolve(__dirname, '.next', '@mf-types.zip');
        const mfTypesDest = path.resolve(
          __dirname,
          '.next',
          'static',
          'chunks',
          '@mf-types.zip',
        );
        config.plugins.push(
          new CopyPlugin({
            patterns: [
              {
                from: mfTypesSource,
                to: mfTypesDest,
                force: true,
                noErrorOnMissing: true,
              },
            ],
          }),
        );
      }
      if (process.env.NEXT_PUBLIC_SW_DEACTIVATED !== 'true') {
        config.plugins.push(
          new InjectManifest({
            swSrc: './src/features/service-worker/service-worker.ts',
            swDest: '../public/service-worker.js',
            include: [
              ({ asset }) => {
                return !!asset.name.match(/.*(static).*/);
              },
            ],
          }),
        );
      }
    }

    // Modify the file loader rule to ignore *.svg, since we have it handled now.
    fileLoaderRule.exclude = /\.svg$/i;
    return config;
  },
};

module.exports = nextConfig;
