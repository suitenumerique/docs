import { expect, test } from '@playwright/test';

test.describe('Footer', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('checks all the elements are visible', async ({ page }) => {
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

  const legalPages = [
    { name: 'Legal Notice', url: '/legal-notice/' },
    { name: 'Personal data and cookies', url: '/personal-data-cookies/' },
    { name: 'Accessibility', url: '/accessibility/' },
  ];
  for (const { name, url } of legalPages) {
    test(`checks ${name} page`, async ({ page }) => {
      await page.goto('/');

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
