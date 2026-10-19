/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { RouteMatchCallback, RouteMatchCallbackOptions } from 'workbox-core';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, NetworkOnly } from 'workbox-strategies';

import { ApiPlugin } from '../plugins/ApiPlugin';
import '../service-worker-api';

const ORIGIN = 'https://docs.example.org';

// The module registers its routes as soon as it is imported
vi.hoisted(() => {
  (global as any).self = {
    location: { origin: 'https://docs.example.org' },
    addEventListener: vi.fn(),
  };
});

vi.mock('workbox-routing', () => ({
  registerRoute: vi.fn(),
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
  handler,
  method,
}));

/**
 * Like workbox, the strategy of the first GET route matching the url.
 */
const getStrategy = (href: string) =>
  routes.find(
    ({ match, method }) =>
      method === 'GET' &&
      match({ url: new URL(href) } as RouteMatchCallbackOptions),
  )?.handler;

describe('service-worker-api', () => {
  [
    '/api/v1.0/authenticate/',
    '/api/v1.0/authenticate/?silent=true&next=https%3A%2F%2Fdocs.example.org%2F',
    '/api/v1.0/callback/?state=abc&code=def',
    '/api/v1.0/logout/',
    '/api/v1.0/logout-callback/?state=abc',
  ].forEach((path) => {
    it(`never serves the auth navigation ${path} from the cache`, () => {
      expect(getStrategy(`${ORIGIN}${path}`)).toBeInstanceOf(NetworkOnly);
    });
  });

  it('replays the offline mutations before the logout ends the session', () => {
    const strategy = getStrategy(`${ORIGIN}/api/v1.0/logout/`) as NetworkOnly;

    expect(strategy.plugins).toContainEqual(expect.any(ApiPlugin));
  });

  it('keeps the other api calls on the cached route', () => {
    expect(getStrategy(`${ORIGIN}/api/v1.0/users/me/`)).toBeInstanceOf(
      NetworkFirst,
    );
  });
});
