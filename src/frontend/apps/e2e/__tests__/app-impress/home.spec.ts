import { expect, test } from '@playwright/test';

import { overrideConfig } from './common';

test.beforeEach(async ({ page }) => {
  await page.goto('/docs/');
});

test.describe('Home page', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test('checks all the elements are visible', async ({ page }) => {
    await page.goto('/docs/');

    // Check header content
    const header = page.locator('header').first();
    const footer = page.locator('footer').first();
    await expect(header).toBeVisible();
    await expect(
      header.getByRole('button', { name: /Language/ }),
    ).toBeVisible();
    await expect(header.getByRole('img', { name: 'Docs logo' })).toBeVisible();
    await expect(header.getByRole('heading', { name: 'Docs' })).toBeVisible();

    // Check the titles
    const h2 = page.locator('h2');
    await expect(h2.getByText('Govs ❤️ Open Source.')).toBeVisible();
    await expect(
      h2.getByText('Collaborative writing, Simplified.'),
    ).toBeVisible();
    await expect(
      h2.getByText('An uncompromising writing experience.'),
    ).toBeVisible();
    await expect(
      h2.getByText('Simple and secure collaboration.'),
    ).toBeVisible();
    await expect(h2.getByText('Flexible export.')).toBeVisible();
    await expect(
      h2.getByText('A new way to organize knowledge.'),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Start Writing' }),
    ).toBeVisible();

    await expect(footer).toBeVisible();
  });

  test('checks all the elements are visible with dsfr theme', async ({
    page,
  }) => {
    await overrideConfig(page, {
      FRONTEND_THEME: 'dsfr',
      theme_customization: {
        footer: {
          default: {
            externalLinks: [
              {
                label: 'legifrance.gouv.fr',
                href: '#',
              },
            ],
          },
        },
      },
    });

    await page.goto('/docs/');

    // Check header content
    const header = page.locator('header').first();
    const footer = page.locator('footer').first();
    await expect(header).toBeVisible();
    await expect(
      header.getByRole('button', { name: /Language/ }),
    ).toBeVisible();
    await expect(
      header.getByRole('button', { name: 'Les services de La Suite numé' }),
    ).toBeVisible();
    await expect(
      header.getByRole('img', { name: 'Gouvernement Logo' }),
    ).toBeVisible();
    await expect(header.getByRole('img', { name: 'Docs logo' })).toBeVisible();
    await expect(header.getByRole('heading', { name: 'Docs' })).toBeVisible();

    // Check the titles
    const h2 = page.locator('h2');
    await expect(h2.getByText('Govs ❤️ Open Source.')).toBeVisible();
    await expect(
      h2.getByText('Collaborative writing, Simplified.'),
    ).toBeVisible();
    await expect(
      h2.getByText('An uncompromising writing experience.'),
    ).toBeVisible();
    await expect(
      h2.getByText('Simple and secure collaboration.'),
    ).toBeVisible();
    await expect(h2.getByText('Flexible export.')).toBeVisible();
    await expect(
      h2.getByText('A new way to organize knowledge.'),
    ).toBeVisible();

    await expect(
      page.getByText('Docs is already available, log in to use it now.'),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Proconnect Login' }),
    ).toHaveCount(2);

    await expect(footer).toBeVisible();
  });

  test('it checks the homepage feature flag', async ({ page }) => {
    await overrideConfig(page, {
      FRONTEND_HOMEPAGE_FEATURE_ENABLED: false,
    });

    await page.goto('/');

    // Keyclock login page
    await expect(
      page.locator('.login-pf-page-header').getByText('impress'),
    ).toBeVisible();
  });
});
