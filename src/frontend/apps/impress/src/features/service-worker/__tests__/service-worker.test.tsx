/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { RouteMatchCallback, RouteMatchCallbackOptions } from 'workbox-core';
import { registerRoute } from 'workbox-routing';
import { Strategy } from 'workbox-strategies';

import { ApiPlugin } from '../plugins/ApiPlugin';
import { OfflinePlugin } from '../plugins/OfflinePlugin';
import '../service-worker';

const ORIGIN = 'https://docs.example.org';

// The modules register their routes as soon as they are imported
vi.hoisted(() => {
  (global as any).self = {
    location: {
      origin: 'https://docs.example.org',
      href: 'https://docs.example.org/',
    },
    addEventListener: vi.fn(),
    __WB_MANIFEST: [],
  };
});

vi.mock('workbox-core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('workbox-core')>()),
  setCacheNameDetails: vi.fn(),
}));

vi.mock('workbox-routing', () => ({
  registerRoute: vi.fn(),
  setCatchHandler: vi.fn(),
  setDefaultHandler: vi.fn(),
}));

vi.mock('workbox-precaching', () => ({
  precacheAndRoute: vi.fn(),
  cleanupOutdatedCaches: vi.fn(),
}));

vi.mock('workbox-recipes', () => ({
  googleFontsCache: vi.fn(),
  warmStrategyCache: vi.fn(),
}));

vi.mock('../DocsDB', () => ({
  DocsDB: {
    sync: vi.fn(),
    hasSyncToDo: vi.fn().mockResolvedValue(false),
    cleanupOutdatedVersion: vi.fn(),
  },
}));

const { calls } = vi.mocked(registerRoute).mock;

// In registration order, read before the mocks are cleared between tests
const routes = calls.map(([match, handler, method]) => ({
  match: match as RouteMatchCallback,
  handler: handler as Strategy,
  method: method ?? 'GET',
}));

/**
 * Like workbox, the strategy of the first route matching the request.
 */
const getStrategy = (method: string, href: string, destination = '') =>
  routes.find(
    (route) =>
      route.method === method &&
      route.match({
        url: new URL(href),
        request: { destination },
      } as RouteMatchCallbackOptions),
  )?.handler;

const reportsOffline = (method: string, href: string, destination = '') =>
  !!getStrategy(method, href, destination)?.plugins.some(
    (plugin) => plugin instanceof OfflinePlugin,
  );

describe('service-worker', () => {
  [
    'https://sentry.example.net/api/42/envelope/',
    'https://product.example.org/e/',
    'https://posthog.example.org/batch/',
  ].forEach((href) => {
    it(`does not report offline when the third-party POST ${href} fails`, () => {
      expect(reportsOffline('POST', href)).toBe(false);
    });
  });

  it('does not take a third-party url carrying an api url for the api', () => {
    const href = `https://sentry.example.net/api/42/envelope/?url=${ORIGIN}/api/v1.0/documents/`;

    expect(reportsOffline('POST', href)).toBe(false);
    expect(reportsOffline('GET', href)).toBe(false);
  });

  it('reports offline when an api call fails', () => {
    expect(reportsOffline('POST', `${ORIGIN}/api/v1.0/documents/`)).toBe(true);
    expect(reportsOffline('GET', `${ORIGIN}/api/v1.0/users/me/`)).toBe(true);
  });

  [
    ['POST', '/api/v1.0/documents/123/duplicate/'],
    ['PUT', '/api/v1.0/documents/123/accesses/456/'],
    ['PATCH', '/api/v1.0/documents/123/accesses/456/'],
    ['DELETE', '/api/v1.0/documents/123/accesses/456/'],
  ].forEach(([method, pathname]) => {
    it(`reports offline when the api mutation ${method} ${pathname} fails`, () => {
      expect(reportsOffline(method, `${ORIGIN}${pathname}`)).toBe(true);
    });
  });

  it('keeps the routes replaying the api mutations offline first', () => {
    [
      ['POST', '/api/v1.0/documents/'],
      ['PATCH', '/api/v1.0/documents/123/'],
      ['DELETE', '/api/v1.0/documents/123/'],
    ].forEach(([method, pathname]) => {
      expect(
        getStrategy(method, `${ORIGIN}${pathname}`)?.plugins.some(
          (plugin) => plugin instanceof ApiPlugin,
        ),
      ).toBe(true);
    });
  });

  it('reports offline when the collaboration server cannot be reached', () => {
    expect(
      reportsOffline(
        'PATCH',
        'https://collab.example.org/collaboration/ydoc/v1/docs/123/',
      ),
    ).toBe(true);
  });

  it('reports offline when a page cannot be loaded', () => {
    expect(reportsOffline('GET', `${ORIGIN}/docs/123/`, 'document')).toBe(true);
  });
});
