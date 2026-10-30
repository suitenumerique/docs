import { expect, test } from '@playwright/test';

test.describe('Offline', () => {
  test('checks all the elements are visible', async ({ page }) => {
    await page.goto('/offline');

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Offline ?!',
      }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Can't load this page, please check your internet connection.",
      ),
    ).toBeVisible();
    await expect(page.getByTestId('header-logo-link')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Refresh page' }),
    ).toBeVisible();
    await expect(page).toHaveTitle(/Offline - Docs/);
  });
});
