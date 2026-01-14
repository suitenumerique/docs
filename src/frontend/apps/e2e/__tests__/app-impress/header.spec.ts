import { expect, test } from '@playwright/test';

import {
  expectLoginPage,
  keyCloakSignIn,
  overrideConfig,
} from './utils-common';

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
          logo: {
            src: '/assets/logo-gouv.svg',
            width: '220px',
            alt: 'Gouvernement Logo',
          },
        },
      },
    });
    await page.goto('/');

    const header = page.locator('header').first();

    await expect(header.getByTestId('header-icon-docs')).toBeVisible();
    await expect(header.locator('h1').getByText('Docs')).toHaveCSS(
      'font-family',
      /Marianne/i,
    );

    await expect(
      header.getByRole('button', {
        name: 'Logout',
      }),
    ).toBeVisible();

    await expect(header.getByText('English')).toBeVisible();
  });

  test('checks a custom waffle', async ({ page }) => {
    await overrideConfig(page, {
      theme_customization: {
        waffle: {
          data: {
            services: [
              {
                name: 'Docs E2E Custom 1',
                url: 'https://docs.numerique.gouv.fr/',
                maturity: 'stable',
                logo: 'https://lasuite.numerique.gouv.fr/assets/products/docs.svg',
              },
              {
                name: 'Docs E2E Custom 2',
                url: 'https://docs.numerique.gouv.fr/',
                maturity: 'stable',
                logo: 'https://lasuite.numerique.gouv.fr/assets/products/docs.svg',
              },
            ],
          },
          showMoreLimit: 9,
        },
      },
    });
    await page.goto('/');

    const header = page.locator('header').first();

    await expect(
      header.getByRole('button', { name: 'Digital LaSuite services' }),
    ).toBeVisible();

    /**
     * The Waffle loads a js file from a remote server,
     * it takes some time to load the file and have the interaction available
     */
    await page.waitForTimeout(1500);

    await header
      .getByRole('button', { name: 'Digital LaSuite services' })
      .click();

    await expect(
      page.getByRole('link', { name: 'Docs E2E Custom 1' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Docs E2E Custom 2' }),
    ).toBeVisible();
  });

  test('checks the waffle dsfr', async ({ page }) => {
    await overrideConfig(page, {
      theme_customization: {
        waffle: {
          apiUrl: 'https://lasuite.numerique.gouv.fr/api/services',
          showMoreLimit: 9,
        },
      },
    });
    await page.goto('/');

    const header = page.locator('header').first();

    await expect(
      header.getByRole('button', { name: 'Digital LaSuite services' }),
    ).toBeVisible();

    /**
     * The Waffle loads a js file from a remote server,
     * it takes some time to load the file and have the interaction available
     */
    await page.waitForTimeout(1500);

    await header
      .getByRole('button', {
        name: 'Digital LaSuite services',
      })
      .click();

    await expect(page.getByRole('link', { name: 'Tchap' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Grist' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Visio' })).toBeVisible();
  });
});

test.describe('Header mobile', () => {
  test.use({ viewport: { width: 500, height: 1200 } });

  test('it checks the header when mobile with DSFR theme', async ({ page }) => {
    await overrideConfig(page, {
      FRONTEND_THEME: 'dsfr',
      theme_customization: {
        header: {
          logo: {
            src: '/assets/logo-gouv.svg',
            width: '220px',
            alt: 'Gouvernement Logo',
          },
        },
      },
    });

    await page.goto('/');

    const header = page.locator('header').first();

    await expect(header.getByLabel('Open the header menu')).toBeVisible();
    await expect(header.getByTestId('header-icon-docs')).toBeVisible();
  });
});

test.describe('Header: Log out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  // eslint-disable-next-line playwright/expect-expect
  test('checks logout button', async ({ page, browserName }) => {
    await page.goto('/');
    await keyCloakSignIn(page, browserName);

    await page
      .getByRole('button', {
        name: 'Logout',
      })
      .click();

    await expectLoginPage(page);
  });
});

test.describe('Header: Override configuration', () => {
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

test.describe('Header: Skip to Content', () => {
  test('it displays skip link on first TAB and focuses main content on click', async ({
    page,
  }) => {
    await page.goto('/');

    // Wait for skip button to be mounted (client-side only component)
    const skipButton = page.getByRole('button', { name: 'Go to content' });
    await skipButton.waitFor({ state: 'attached' });

    // First TAB shows the skip button
    await page.keyboard.press('Tab');

    // The skip button should be visible and focused
    await expect(skipButton).toBeFocused();
    await expect(skipButton).toBeVisible();

    // Clicking moves focus to the main content
    await skipButton.click();
    const mainContent = page.locator('main#mainContent');
    await expect(mainContent).toBeFocused();
  });
});
