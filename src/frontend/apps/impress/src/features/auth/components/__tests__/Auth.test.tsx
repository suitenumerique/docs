import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { KEY_AUTH, User, useAuthQuery } from '../../api';
import { Auth } from '../Auth';

/**
 * Renders along with Auth on the same query update, so the test can wait for
 * Auth to take a failed refresh into account.
 */
const UserQueryStatus = () => {
  const { isError } = useAuthQuery();

  return <div>{isError ? 'User refresh failed' : 'App content'}</div>;
};

/**
 * Like the Next.js router, `replace` changes the route and renders the app on
 * it before its promise resolves, so `pathname` and `asPath` follow the
 * redirects of `Auth`.
 */
const { mockRouter } = vi.hoisted(() => {
  const initialRoute = { pathname: '/', asPath: '/' };
  const listeners = new Set<() => void>();
  let route = initialRoute;

  return {
    mockRouter: {
      getRoute: () => route,
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      reset: () => {
        route = initialRoute;
      },
      replace: vi.fn((url: string) => {
        route = { pathname: url.split('?')[0], asPath: url };
        listeners.forEach((listener) => listener());
        return Promise.resolve(true);
      }),
    },
  };
});

vi.mock('next/router', async () => {
  const { useSyncExternalStore } =
    await vi.importActual<typeof import('react')>('react');

  return {
    ...(await vi.importActual('next/router')),
    useRouter: () => ({
      ...useSyncExternalStore(mockRouter.subscribe, mockRouter.getRoute),
      replace: mockRouter.replace,
    }),
  };
});

const mockLocationReplace = vi.fn();
Object.defineProperty(window, 'location', {
  value: {
    ...window.location,
    replace: mockLocationReplace,
    href: 'http://test.jest/',
    pathname: '/',
  },
  writable: true,
  configurable: true,
});

describe('<Auth />', () => {
  beforeEach(() => {
    fetchMock.mockGlobal();
    fetchMock.get('http://test.jest/api/v1.0/config/', {
      FRONTEND_HOMEPAGE_FEATURE_ENABLED: false,
      FRONTEND_SILENT_LOGIN_ENABLED: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockRouter.reset();
    fetchMock.hardReset();
  });

  it.each([
    ['a 500', 500, '/500?from=%2F'],
    ['a 502', 502, '/offline'],
    [
      'a network error',
      { throws: new TypeError('Failed to fetch') },
      '/offline',
    ],
  ])(
    'redirects once to an error page when the user cannot be loaded (%s)',
    async (_, response, errorUrl) => {
      fetchMock.get('http://test.jest/api/v1.0/users/me/', response);

      render(
        <Auth>
          <div>App content</div>
        </Auth>,
        { wrapper: AppWrapper },
      );

      // Auth also wraps the error page: its content shows up once redirected
      expect(await screen.findByText('App content')).toBeInTheDocument();
      expect(mockRouter.getRoute().asPath).toBe(errorUrl);
      expect(mockRouter.replace).toHaveBeenCalledTimes(1);
      expect(mockLocationReplace).not.toHaveBeenCalled();
    },
  );

  it('redirects to the login page when the user is not logged in', async () => {
    fetchMock.get('http://test.jest/api/v1.0/users/me/', 401);

    render(
      <Auth>
        <div>App content</div>
      </Auth>,
      { wrapper: AppWrapper },
    );

    await vi.waitFor(() =>
      expect(mockLocationReplace).toHaveBeenCalledWith(
        'http://test.jest/api/v1.0/authenticate/',
      ),
    );
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('keeps a logged in user on the page when refreshing them fails', async () => {
    fetchMock.get('http://test.jest/api/v1.0/users/me/', 500);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData<User>([KEY_AUTH], {
      id: 'user-id',
      email: 'user@test.jest',
      full_name: 'User',
      short_name: 'User',
      is_first_connection: false,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <Auth>
          <UserQueryStatus />
        </Auth>
      </QueryClientProvider>,
      { wrapper: AppWrapper },
    );

    expect(screen.getByText('App content')).toBeInTheDocument();

    await act(() => queryClient.invalidateQueries({ queryKey: [KEY_AUTH] }));

    // Still the page, not the loader, once Auth has seen the failed refresh
    expect(await screen.findByText('User refresh failed')).toBeInTheDocument();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockLocationReplace).not.toHaveBeenCalled();
  });
});
