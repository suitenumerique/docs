import { expect, test } from '@playwright/test';

test.describe('500', () => {
  test('checks all the elements are visible', async ({ page }) => {
    await page.goto('/500');

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Error 500',
      }),
    ).toBeVisible();
    await expect(
      page.getByText(
        'An unexpected error occurred. Go grab a coffee or try to refresh the page.',
      ),
    ).toBeVisible();
    await expect(page.getByTestId('header-logo-link')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Refresh page' }),
    ).toBeVisible();
    await expect(page).toHaveTitle(/Error 500 - Docs/);
  });
});
