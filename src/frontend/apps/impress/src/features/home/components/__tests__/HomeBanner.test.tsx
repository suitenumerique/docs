import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import HomeBanner from '../HomeBanner';

const { mockConfig, mockResponsiveStore } = vi.hoisted(() => ({
  mockConfig: {
    data: undefined as
      | {
          theme_customization?: {
            home?: {
              'with-proconnect'?: boolean;
              'cta-label'?: string;
            };
          };
        }
      | undefined,
  },
  mockResponsiveStore: {
    isMobile: false,
    isSmallMobile: false,
  },
}));

vi.mock('@/core', async () => {
  const actual = await vi.importActual<typeof import('@/core')>('@/core');

  return {
    ...actual,
    useConfig: () => mockConfig,
  };
});

vi.mock('@/stores', async () => {
  const actual = await vi.importActual<typeof import('@/stores')>('@/stores');

  return {
    ...actual,
    useResponsiveStore: () => mockResponsiveStore,
  };
});

const renderBanner = () =>
  render(
    <AppWrapper>
      <HomeBanner />
    </AppWrapper>,
  );

describe('<HomeBanner />', () => {
  it('shows a login call to action', () => {
    renderBanner();

    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
  });

  it('shows the call to action without an icon', () => {
    renderBanner();

    const callToAction = screen.getByRole('button', { name: 'Login' });

    // The icon of the button used to be a material icon glyph, rendered as a
    // text node next to the label.
    expect(callToAction.querySelector('.material-icons')).toBeNull();
    expect(callToAction).toHaveTextContent(/^Login$/);
  });

  it('shows the call to action label of the theme customization', () => {
    mockConfig.data = {
      theme_customization: {
        home: {
          'cta-label': 'Access',
        },
      },
    };

    renderBanner();

    expect(screen.getByRole('button', { name: 'Access' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Login' }),
    ).not.toBeInTheDocument();

    mockConfig.data = undefined;
  });

  it('shows the ProConnect button instead of the call to action', () => {
    mockConfig.data = {
      theme_customization: {
        home: {
          'with-proconnect': true,
        },
      },
    };

    renderBanner();

    expect(
      screen.getByRole('button', { name: 'Proconnect Login' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Login' }),
    ).not.toBeInTheDocument();

    mockConfig.data = undefined;
  });

  it('shows the ProConnect button instead of the call to action label', () => {
    mockConfig.data = {
      theme_customization: {
        home: {
          'with-proconnect': true,
          'cta-label': 'Access',
        },
      },
    };

    renderBanner();

    // The ProConnect button replaces the call to action, so the label of the
    // call to action is not used at all.
    expect(
      screen.getByRole('button', { name: 'Proconnect Login' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Access' }),
    ).not.toBeInTheDocument();

    mockConfig.data = undefined;
  });
});
