import { expect, test } from '@playwright/test';

test.describe('Left panel desktop', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('checks all the elements are visible', async ({ page }) => {
    await expect(page.getByTestId('left-panel-desktop')).toBeVisible();
    await expect(page.getByRole('button', { name: 'house' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New doc' })).toBeVisible();
  });
});

test.describe('Left panel mobile', () => {
  test.use({ viewport: { width: 500, height: 1200 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('checks all the desktop elements are hidden', async ({ page }) => {
    await expect(page.getByTestId('left-panel-desktop')).toBeHidden();
  });
});
