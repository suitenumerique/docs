import { expect, test } from '@playwright/test';

import { overrideConfig } from './common';

test.describe('Footer', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('checks all the elements are visible', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer').first();

    await expect(footer.locator('h2').first().getByText('Docs')).toBeVisible();

    await expect(footer.getByRole('link', { name: 'Github' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Dinum' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'ZenDiS' })).toBeVisible();
    await expect(
      footer.getByRole('link', { name: 'BlockNote.js' }),
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

  test('checks all the elements are visible with theme DSFR', async ({
    page,
  }) => {
    await overrideConfig(page, {
      FRONTEND_THEME: 'default',
      FRONTEND_PATH_JSON_FOOTER:
        'http://localhost:3000/contents/footer-dsfr.json',
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
