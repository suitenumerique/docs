import { render, screen, waitFor } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { Auth } from '../Auth';

const { mockRouterReplace } = vi.hoisted(() => ({
  mockRouterReplace: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('next/router', async () => ({
  ...(await vi.importActual('next/router')),
  useRouter: () => ({
    pathname: '/',
    asPath: '/',
    replace: mockRouterReplace,
  }),
}));

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
    fetchMock.hardReset();
  });

  it.each([
    [500, '/500?from=%2F'],
    [502, '/offline'],
  ])(
    'redirects to an error page when the user cannot be loaded (%i)',
    async (status, errorUrl) => {
      fetchMock.get('http://test.jest/api/v1.0/users/me/', status);

      render(
        <Auth>
          <div>App content</div>
        </Auth>,
        { wrapper: AppWrapper },
      );

      // useAuthQuery retries once before failing
      await waitFor(
        () => expect(mockRouterReplace).toHaveBeenCalledWith(errorUrl),
        { timeout: 3000 },
      );
      expect(mockRouterReplace).toHaveBeenCalledTimes(1);
      expect(mockLocationReplace).not.toHaveBeenCalled();
      expect(screen.queryByText('App content')).not.toBeInTheDocument();
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

    await waitFor(() =>
      expect(mockLocationReplace).toHaveBeenCalledWith(
        'http://test.jest/api/v1.0/authenticate/',
      ),
    );
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });
});
