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
import { ApiPlugin } from './ApiPlugin';
import { DAYS_EXP, SW_DEV_URL, SW_VERSION, getCacheNameVersion } from './conf';
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
 * In development, use NetworkFirst strategy, in production use CacheFirst strategy
 * We will be able to test the application in development without having to clear the cache.
 * @param url
 * @param options
 * @returns strategy
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
 * Cache stategy static files images (images / svg)
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
 * Cache stategy static files fonts
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
 * Cache stategy static files (css, js, workers)
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
