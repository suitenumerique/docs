/// <reference lib="webworker" />

import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { setCacheNameDetails } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { googleFontsCache, warmStrategyCache } from 'workbox-recipes';
import {
  registerRoute,
  setCatchHandler,
  setDefaultHandler,
} from 'workbox-routing';
import {
  CacheFirst,
  NetworkFirst,
  NetworkFirstOptions,
  NetworkOnly,
  StrategyOptions,
} from 'workbox-strategies';

// eslint-disable-next-line import/order
import { DAYS_EXP, SW_DEV_URL, SW_VERSION, getCacheNameVersion } from './conf';
import { ApiPlugin } from './plugins/ApiPlugin';
import { OfflinePlugin } from './plugins/OfflinePlugin';
import { isApiUrl } from './service-worker-api';

// eslint-disable-next-line import/order
import pkg from '@/../package.json';

declare const self: ServiceWorkerGlobalScope & {
  __WB_DISABLE_DEV_LOGS: boolean;
};

self.__WB_DISABLE_DEV_LOGS = true;

setCacheNameDetails({
  prefix: pkg.name,
  suffix: SW_VERSION,
});

/**
 * Chooses the appropriate caching strategy based on the environment and request context.
 *
 * - In **development**, or for **API requests**, or **HTML pages**, it returns a `NetworkFirst` strategy
 *   to prioritize fresh responses and ease debugging without needing to clear caches.
 * - In **production** (for non-API, non-HTML content), it returns a `CacheFirst` strategy
 *   to favor performance and offline access.
 *
 * @param {NetworkFirstOptions | StrategyOptions} [options] - Configuration options for the caching strategy.
 * @returns {NetworkFirst | CacheFirst} The selected Workbox strategy instance.
 */
const getStrategy = (
  options?: NetworkFirstOptions | StrategyOptions,
): NetworkFirst | CacheFirst => {
  const isDev = SW_DEV_URL.some((devDomain) =>
    self.location.origin.includes(devDomain),
  );
  const isApi = isApiUrl(self.location.href);
  const isHTMLRequest = options?.cacheName?.includes('html');

  return isDev || isApi || isHTMLRequest
    ? new NetworkFirst(options)
    : new CacheFirst(options);
};

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

self.addEventListener('install', function (event) {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('message', (event) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (event.data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

self.addEventListener('activate', function (event) {
  const cacheAllow = SW_VERSION;

  event.waitUntil(
    // Delete old caches
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (!key.includes(cacheAllow)) {
              return caches.delete(key);
            }
          }),
        );
      })
      .then(() => self.clients.claim()),
  );
});

/**
 * Precache resources
 */
const FALLBACK = {
  offline: '/offline/',
  docs: '/docs/[id]/',
  images: '/assets/img-not-found.svg',
};
const precacheResources = [
  '/',
  '/index.html',
  '/404/',
  '/accessibility/',
  '/legal-notice/',
  '/personal-data-cookies/',
  '/import-notion',
  FALLBACK.offline,
  FALLBACK.images,
  FALLBACK.docs,
];

const precacheStrategy = getStrategy({
  cacheName: getCacheNameVersion('precache'),
  plugins: [new CacheableResponsePlugin({ statuses: [0, 200, 404] })],
});

warmStrategyCache({ urls: precacheResources, strategy: precacheStrategy });

/**
 * Handle requests that fail
 */
setCatchHandler(async ({ request, url, event }) => {
  switch (true) {
    case isApiUrl(url.href):
      return ApiPlugin.getApiCatchHandler();

    case request.destination === 'document':
      if (url.pathname.match(/^\/docs\/([a-z0-9\-]+)\/$/g)) {
        return precacheStrategy.handle({ event, request: FALLBACK.docs });
      }

      return precacheStrategy.handle({ event, request: FALLBACK.offline });

    case request.destination === 'image':
      return precacheStrategy.handle({ event, request: FALLBACK.images });

    default:
      return Response.error();
  }
});

// HTML documents
registerRoute(
  ({ request }) => request.destination === 'document',
  new NetworkFirst({
    cacheName: getCacheNameVersion('html'),
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxAgeSeconds: 24 * 60 * 60 * DAYS_EXP }),
      new OfflinePlugin(),
    ],
  }),
);

/**
 * External urls cache strategy
 */
registerRoute(
  ({ url }) => !url.href.includes(self.location.origin),
  new NetworkFirst({
    cacheName: getCacheNameVersion('default-external'),
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxAgeSeconds: 24 * 60 * 60 * DAYS_EXP,
      }),
      new OfflinePlugin(),
    ],
  }),
  'GET',
);

/**
 * Admin cache strategy
 */
registerRoute(
  ({ url }) =>
    url.href.includes(self.location.origin) && url.href.includes('/admin/'),
  new NetworkOnly(),
);

/**
 * Cache strategy static files images (images / svg)
 */
registerRoute(
  ({ request }) => request.destination === 'image',
  getStrategy({
    cacheName: getCacheNameVersion('images'),
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxAgeSeconds: 24 * 60 * 60 * DAYS_EXP,
      }),
    ],
  }),
);

/**
 * Cache strategy static files fonts
 */
googleFontsCache();
registerRoute(
  ({ request }) => request.destination === 'font',
  getStrategy({
    cacheName: getCacheNameVersion('fonts'),
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxAgeSeconds: 24 * 60 * 60 * 30, // 30 days
      }),
    ],
  }),
);

/**
 * Cache strategy static files (css, js, workers)
 */
registerRoute(
  ({ request }) =>
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'worker',
  getStrategy({
    cacheName: getCacheNameVersion('static'),
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxAgeSeconds: 24 * 60 * 60 * DAYS_EXP,
      }),
    ],
  }),
);

/**
 * External urls post cache strategy
 * It is interesting to intercept the request
 * to have a fine grain control about if the user is
 * online or offline
 */
registerRoute(
  ({ url }) => !url.href.includes(self.location.origin) && !isApiUrl(url.href),
  new NetworkOnly({
    plugins: [new OfflinePlugin()],
  }),
  'POST',
);

/**
 * Cache all other files
 */
setDefaultHandler(
  getStrategy({
    cacheName: getCacheNameVersion('default'),
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxAgeSeconds: 24 * 60 * 60 * DAYS_EXP,
      }),
    ],
  }),
);
