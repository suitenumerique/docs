import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(
    page.locator('header').first().locator('h2').getByText('Docs'),
  ).toBeVisible();
  await page.goto('unknown-page404');
});

test.describe('404', () => {
  test('Checks all the elements are visible', async ({ page }) => {
    await expect(page.getByLabel('Image 404')).toBeVisible();
    await expect(page.getByText('Ouch')).toBeVisible();
    await expect(
      page.getByText(
        'It seems that the page you are looking for does not exist or cannot be displayed correctly.',
      ),
    ).toBeVisible();
    await expect(page.getByText('Home')).toBeVisible();
  });

  test('checks go back to home page redirects to home page', async ({
    page,
  }) => {
    await page.getByText('Home').click();
    await expect(page).toHaveURL('/');
  });
});
