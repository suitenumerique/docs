const crypto = require('crypto');
const path = require('path');

const { InjectManifest } = require('workbox-webpack-plugin');

const { version } = require('./package.json');

const buildId = crypto.randomBytes(256).toString('hex').slice(0, 8);

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['docs.127.0.0.1.nip.io'],
  // A Node server (`node server.js`) rather than a static export, so the doc
  // page can render its title server-side for link previews.
  output: 'standalone',
  // Trace from the yarn workspace root, so the shared packages are bundled
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // Images are not optimized: leave out sharp and its native binaries
  outputFileTracingExcludes: { '*': ['node_modules/@img/**'] },
  trailingSlash: true,
  poweredByHeader: false,
  // Headers the nginx config of the static export used to send.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [{ key: 'X-Frame-Options', value: 'DENY' }],
      },
      {
        // Everything but the hashed chunks has a stable name: revalidate it, so
        // a cache in front never serves the chunk list of an old release
        source: '/((?!_next/static/).*)',
        headers: [{ key: 'Cache-Control', value: 'no-cache' }],
      },
      {
        // Only `/` and `/home` are indexable. A header, as a meta tag needs
        // JavaScript.
        source: '/((?!home/?$).+)',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex' }],
      },
    ];
  },
  images: {
    unoptimized: true,
  },
  compiler: {
    // Enables the styled-components SWC transform
    styledComponents: true,
  },
  experimental: {
    // Next.js 16.3 defaults `next build` to the `tsc` CLI, which type-checks the
    // whole tsconfig project (test files included) and chokes on vitest globals.
    // Keep the compiler-API checker, which skips test files. Safe on TypeScript 6.
    useTypeScriptCli: false,
  },
  generateBuildId: () => buildId,
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
    NEXT_PUBLIC_APP_VERSION: version,
  },
  /**
   * In dev mode, Next.js doesn't use Webpack, but Turbopack.
   */
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  webpack(config, { isServer }) {
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

    if (!isServer && process.env.NEXT_PUBLIC_SW_DEACTIVATED !== 'true') {
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

    // Modify the file loader rule to ignore *.svg, since we have it handled now.
    fileLoaderRule.exclude = /\.svg$/i;

    return config;
  },
};

module.exports = nextConfig;
