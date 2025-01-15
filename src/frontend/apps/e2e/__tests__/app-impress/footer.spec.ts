import { expect, test } from '@playwright/test';

import { keyCloakSignIn } from './common';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('Footer', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test('checks all the elements are visible', async ({ page }) => {
    const footer = page.locator('footer').first();

    await expect(footer.getByAltText('Gouvernement Logo')).toBeVisible();

    await expect(
      footer.getByRole('link', { name: 'legifrance.gouv.fr' }),
    ).toBeVisible();

    await expect(
      footer.getByRole('link', { name: 'info.gouv.fr' }),
    ).toBeVisible();

    await expect(
      footer.getByRole('link', { name: 'service-public.fr' }),
    ).toBeVisible();

    await expect(
      footer.getByRole('link', { name: 'data.gouv.fr' }),
    ).toBeVisible();

    await expect(
      footer.getByRole('link', { name: 'Legal Notice' }),
    ).toBeVisible();

    await expect(
      footer.getByRole('link', { name: 'Personal data and cookies' }),
    ).toBeVisible();

    await expect(
      footer.getByRole('link', { name: 'Accessibility' }),
    ).toBeVisible();

    await expect(
      footer.getByText(
        'Unless otherwise stated, all content on this site is under licence',
      ),
    ).toBeVisible();
  });

  test('checks footer is not visible on doc editor', async ({
    page,
    browserName,
  }) => {
    await page.getByTestId('proconnect-button').first().click();
    await keyCloakSignIn(page, browserName);
    await page.goto('/');

    await expect(page.locator('footer')).toBeHidden();
  });

  const legalPages = [
    { name: 'Legal Notice', url: '/legal-notice/' },
    { name: 'Personal data and cookies', url: '/personal-data-cookies/' },
    { name: 'Accessibility', url: '/accessibility/' },
  ];
  for (const { name, url } of legalPages) {
    test(`checks ${name} page`, async ({ page }) => {
      const footer = page.locator('footer').first();
      await footer.getByRole('link', { name }).click();

      await expect(
        page
          .getByRole('heading', {
            name,
          })
          .first(),
      ).toBeVisible();

      await expect(page).toHaveURL(url);
    });
  }
});
