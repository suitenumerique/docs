import { expect, test } from '@playwright/test';

import { overrideConfig } from './common';

test.describe('Footer', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('checks the feature flag is working', async ({ page }) => {
    await overrideConfig(page, {
      FRONTEND_FOOTER_FEATURE_ENABLED: false,
    });

    await page.goto('/');
    await expect(page.locator('footer')).toBeHidden();
  });

  test('checks all the elements are visible with the "footer-dsfr.json"', async ({
    page,
  }) => {
    await overrideConfig(page, {
      FRONTEND_THEME: 'dsfr',
    });

    await page.goto('/');
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
});
