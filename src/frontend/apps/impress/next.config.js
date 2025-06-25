import crypto from 'crypto';

import { InjectManifest } from 'workbox-webpack-plugin';

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

export default nextConfig;
