import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, NetworkOnly } from 'workbox-strategies';

import { DocsDB } from './DocsDB';
import { SyncManager } from './SyncManager';
import { DAYS_EXP, SW_DEV_API, getCacheNameVersion } from './conf';
import { ApiPlugin } from './plugins/ApiPlugin';
import { OfflinePlugin } from './plugins/OfflinePlugin';

declare const self: ServiceWorkerGlobalScope;

const syncManager = new SyncManager(DocsDB.sync, DocsDB.hasSyncToDo);

self.addEventListener('activate', function (event) {
  event.waitUntil(DocsDB.cleanupOutdatedVersion());
});

export const isApiUrl = (href: string) => {
  return (
    href.includes(`${self.location.origin}/api/`) ||
    href.includes(`${SW_DEV_API}/api/`)
  );
};

const isDocumentApiUrl = (url: URL) =>
  isApiUrl(url.href) && /.*\/documents\/([a-z0-9-]+)\/$/g.test(url.href);

const isCollaborationUrl = (url: URL, endpoint: string) =>
  new RegExp(`/${endpoint}/v1/[^/]+/[^/]+/?$`).test(url.pathname);

/**
 * The collaboration server's rest api: document content (`ydoc`), the editing
 * history (`activity`, `changeset`) and the restore it feeds (`rollback`).
 *
 * `NetworkOnly`, and not by default: the server is on the app's own origin
 * unless an instance moves it, so without a route here these fall into the
 * catch-all `StaleWhileRevalidate` and get served from cache - a document
 * frozen at first read (offline, indistinguishable from a synced round), or a
 * version list missing every version since.
 *
 * Offline content is handled at the doc, not here: the websocket never reaches
 * a service worker, so `IndexeddbPersistence` owns it - see `useProviderStore`.
 */
[
  { endpoint: 'ydoc', methods: ['GET', 'PATCH'] as const },
  { endpoint: 'activity', methods: ['GET'] as const },
  { endpoint: 'changeset', methods: ['GET'] as const },
  { endpoint: 'rollback', methods: ['POST'] as const },
].forEach(({ endpoint, methods }) => {
  methods.forEach((method) => {
    registerRoute(
      ({ url }) => isCollaborationUrl(url, endpoint),
      new NetworkOnly({ plugins: [new OfflinePlugin()] }),
      method,
    );
  });
});

/**
 * API routes
 */
registerRoute(
  ({ url }) =>
    isApiUrl(url.href) &&
    url.href.match(/.*\/documents\/\?(page|ordering)=.*/g),
  new NetworkOnly({
    plugins: [
      new ApiPlugin({
        tableName: 'doc-list',
        type: 'list',
        syncManager,
      }),
      new OfflinePlugin(),
    ],
  }),
  'GET',
);

registerRoute(
  ({ url }) => isDocumentApiUrl(url),
  new NetworkOnly({
    plugins: [
      new ApiPlugin({
        tableName: 'doc-item',
        type: 'item',
        syncManager,
      }),
      new OfflinePlugin(),
    ],
  }),
  'GET',
);

/**
 * Mutate routes for the document update
 * It will save in cache the request if the document update fails, and will retry
 * to sync it later with the SyncManager
 */
registerRoute(
  ({ url }) => isDocumentApiUrl(url),
  new NetworkOnly({
    plugins: [
      new ApiPlugin({
        type: 'update',
        syncManager,
      }),
      new OfflinePlugin(),
    ],
  }),
  'PATCH',
);

registerRoute(
  ({ url }) => isApiUrl(url.href) && url.href.match(/.*\/documents\/$/g),
  new NetworkOnly({
    plugins: [
      new ApiPlugin({
        type: 'create',
        syncManager,
      }),
      new OfflinePlugin(),
    ],
  }),
  'POST',
);

registerRoute(
  ({ url }) => isDocumentApiUrl(url),
  new NetworkOnly({
    plugins: [
      new ApiPlugin({
        type: 'delete',
        syncManager,
      }),
      new OfflinePlugin(),
    ],
  }),
  'DELETE',
);

registerRoute(
  ({ url }) => isApiUrl(url.href),
  new NetworkFirst({
    cacheName: getCacheNameVersion('api'),
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxAgeSeconds: 24 * 60 * 60 * DAYS_EXP,
      }),
      new ApiPlugin({
        type: 'synch',
        syncManager,
      }),
      new OfflinePlugin(),
    ],
  }),
  'GET',
);
