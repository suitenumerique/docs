import { expect, test } from '@playwright/test';

import { overrideConfig } from './utils-common';
import { SignIn, expectLoginPage } from './utils-signin';

test.describe('Header', () => {
  test('checks all the elements are visible', async ({ page }) => {
    await page.goto('/');

    const header = page.locator('header').first();

    await expect(header.getByTestId('header-logo-link')).toBeVisible();
    await expect(header.locator('h1').getByText('Docs')).toHaveCSS(
      'font-family',
      /Roboto/i,
    );

    await expect(
      header.getByRole('button', {
        name: 'Logout',
      }),
    ).toBeVisible();

    await expect(header.getByText('English')).toBeVisible();
  });

  test('checks all the elements are visible with DSFR theme', async ({
    page,
  }) => {
    await overrideConfig(page, {
      FRONTEND_THEME: 'dsfr',
      theme_customization: {
        header: {
          icon: {
            src: '/assets/icon-docs-v2.svg',
            style: {
              width: '100px',
              height: 'auto',
            },
            alt: '',
            withTitle: false,
            'data-testid': 'custom-testid-docs',
          },
        },
      },
    });
    await page.goto('/');

    const header = page.locator('header').first();

    await expect(header.getByTestId('custom-testid-docs')).toHaveAttribute(
      'src',
      '/assets/icon-docs-v2.svg',
    );
    // With withTitle: false, the h1 is kept for accessibility but visually hidden via sr-only
    await expect(header.locator('h1').getByText('Docs')).toHaveClass(/sr-only/);
  });

  test('it displays skip link on first TAB and focuses page heading on click', async ({
    page,
  }) => {
    await page.goto('/');

    // Wait for skip link to be mounted (client-side only component)
    const skipLink = page.getByRole('link', { name: 'Go to content' });
    await skipLink.waitFor({ state: 'attached' });

    // First TAB shows the skip link
    await page.keyboard.press('Tab');

    // The skip link should be visible and focused
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();
    // Clicking moves focus to the page heading
    await skipLink.click();
    const pageHeading = page.getByRole('heading', {
      name: 'All docs',
      level: 2,
    });
    await expect(pageHeading).toBeFocused();
  });

  test('checks the header is correctly overrided', async ({ page }) => {
    await overrideConfig(page, {
      FRONTEND_THEME: 'dsfr',
      theme_customization: {
        header: {
          icon: {
            src: '/assets/logo-gouv.svg',
            width: '220px',
            height: 'auto',
            alt: '',
          },
        },
      },
    });

    await page.goto('/');
    const header = page.locator('header').first();

    const logoImage = header.getByTestId('header-icon-docs');
    await expect(logoImage).toBeVisible();

    await expect(logoImage).not.toHaveAttribute('src', '/assets/icon-docs.svg');
    await expect(logoImage).toHaveAttribute('src', '/assets/logo-gouv.svg');
    await expect(logoImage).toHaveAttribute('alt', '');
  });
});

test.describe('Header: Log out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  // eslint-disable-next-line playwright/expect-expect
  test('checks logout button', async ({ page, browserName }) => {
    await page.goto('/');
    await SignIn(page, browserName);

    await page
      .getByRole('button', {
        name: 'Logout',
      })
      .click();

    await expectLoginPage(page);
  });
});
