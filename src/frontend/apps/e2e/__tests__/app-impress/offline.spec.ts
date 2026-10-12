import { expect, test } from '@playwright/test';

test.describe('Offline', () => {
  test('checks all the elements are visible', async ({ page }) => {
    await page.goto('/offline');

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Error 502',
      }),
    ).toBeVisible();
    await expect(
      page.getByText(
        'The server encountered a temporary error and could not complete your request',
      ),
    ).toBeVisible();
    await expect(page.getByTestId('header-logo-link')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Refresh page' }),
    ).toBeVisible();
    await expect(page).toHaveTitle(/Error 502 - Docs/);
  });
});
