import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(
    page.locator('nav').first().locator('h1').getByText('Docs'),
  ).toBeVisible();
  await page.goto('unknown-page404');
});

test.describe('404', () => {
  test('Checks all the elements are visible', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: 'Error 404' }),
    ).toBeVisible();
    await expect(
      page.getByText(
        'It seems that the page you are looking for does not exist or cannot be displayed correctly.',
      ),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
    await expect(page.getByTestId('header-logo-link')).toBeVisible();
  });

  test('checks go back to home page redirects to home page', async ({
    page,
  }) => {
    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page).toHaveURL('/');
  });
});
