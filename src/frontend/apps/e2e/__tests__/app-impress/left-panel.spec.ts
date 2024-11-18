import { expect, test } from '@playwright/test';

test.describe('Left panel desktop', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('checks all the elements are visible', async ({ page }) => {
    await expect(page.getByTestId('left-panel-desktop')).toBeVisible();
    await expect(page.getByTestId('left-panel-mobile')).toBeHidden();
    await expect(page.getByRole('button', { name: 'house' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New doc' })).toBeVisible();
  });
});

test.describe('Left panel mobile', () => {
  test.use({ viewport: { width: 500, height: 1200 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('checks all the desktop elements are hidden and all mobile elements are visible', async ({
    page,
  }) => {
    await expect(page.getByTestId('left-panel-desktop')).toBeHidden();
    await expect(page.getByTestId('left-panel-mobile')).not.toBeInViewport();

    const header = page.locator('header').first();
    const homeButton = page.getByRole('button', { name: 'house' });
    const newDocButton = page.getByRole('button', { name: 'New doc' });
    const languageButton = page.getByRole('combobox', { name: 'Language' });
    const logoutButton = page.getByRole('button', { name: 'Logout' });

    await expect(homeButton).not.toBeInViewport();
    await expect(newDocButton).not.toBeInViewport();
    await expect(languageButton).not.toBeInViewport();
    await expect(logoutButton).not.toBeInViewport();

    await header.getByLabel('Open the header menu').click();

    await expect(page.getByTestId('left-panel-mobile')).toBeInViewport();
    await expect(homeButton).toBeInViewport();
    await expect(newDocButton).toBeInViewport();
    await expect(languageButton).toBeInViewport();
    await expect(logoutButton).toBeInViewport();
  });
});
