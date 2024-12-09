import { expect, test } from '@playwright/test';

import { keyCloakSignIn } from './common';

test.describe('Header', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('checks all the elements are visible', async ({ page }) => {
    const header = page.locator('header').first();

    await expect(header.getByAltText('Docs Logo')).toBeVisible();
    await expect(header.locator('h2').getByText('Docs')).toHaveCSS(
      'color',
      'rgb(0, 0, 145)',
    );
    await expect(header.locator('h2').getByText('Docs')).toHaveCSS(
      'font-family',
      /Marianne/i,
    );

    await expect(
      header.getByRole('button', {
        name: 'Logout',
      }),
    ).toBeVisible();

    await expect(header.getByText('English')).toBeVisible();

    await expect(
      header.getByRole('button', {
        name: 'Les services de La Suite numérique',
      }),
    ).toBeVisible();
  });

  test('checks La Gauffre interaction', async ({ page }) => {
    const header = page.locator('header').first();

    await expect(
      header.getByRole('button', {
        name: 'Les services de La Suite numérique',
      }),
    ).toBeVisible();

    /**
     * La gaufre load a js file from a remote server,
     * it takes some time to load the file and have the interaction available
     */
    // eslint-disable-next-line playwright/no-wait-for-timeout
    await page.waitForTimeout(1500);

    await header
      .getByRole('button', {
        name: 'Les services de La Suite numérique',
      })
      .click();

    await expect(
      page.getByRole('link', { name: 'France Transfert' }),
    ).toBeVisible();

    await expect(page.getByRole('link', { name: 'Grist' })).toBeVisible();
  });
});

test.describe('Header mobile', () => {
  test.use({ viewport: { width: 500, height: 1200 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('it checks the header when mobile', async ({ page }) => {
    const header = page.locator('header').first();

    await expect(header.getByLabel('Open the header menu')).toBeVisible();
    await expect(header.getByRole('link', { name: 'Docs Logo' })).toBeVisible();
    await expect(
      header.getByRole('button', {
        name: 'Les services de La Suite numérique',
      }),
    ).toBeVisible();
  });
});

test.describe('Header: Log out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('checks logout button', async ({ page, browserName }) => {
    await page.goto('/');
    await keyCloakSignIn(page, browserName);

    await page
      .getByRole('button', {
        name: 'Logout',
      })
      .click();

    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });
});
