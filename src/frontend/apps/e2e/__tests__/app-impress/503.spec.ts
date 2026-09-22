import { expect, test } from '@playwright/test';

test.describe('503', () => {
  test('checks all the elements are visible', async ({ page }) => {
    await page.goto('/503');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Error 503' }),
    ).toBeVisible();
    await expect(
      page.getByText('The server is temporarily overloaded or unavailable'),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Refresh page' }),
    ).toBeVisible();
    await expect(page.getByTestId('header-logo-link')).toBeVisible();
  });
});
