import { expect, test } from '@playwright/test';

test.describe('Header', () => {
  test('it displays skip link on first TAB and focuses page heading on click', async ({
    page,
  }) => {
    await page.goto('/');

    // Wait for skip link to be mounted (client-side only component)
    const skipLink = page.getByRole('link', { name: 'Go to content' });
    await skipLink.waitFor({ state: 'attached' });

    // First TAB shows the skip link
    await page.keyboard.press('Tab');

    // The skip link should be visible and focused
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();
    // Clicking moves focus to the page heading
    await skipLink.click();
    const pageHeading = page.getByRole('heading', {
      name: 'All docs',
      level: 2,
    });
    await expect(pageHeading).toBeFocused();
  });

  test('checks elements visibility on different screen sizes', async ({
    page,
  }) => {
    // Desktop viewport
    await page.goto('/');

    const header = page.locator('header').first();

    await expect(header.getByLabel('Toggle left panel')).toBeHidden();
    await expect(header.getByLabel('Docs animated icon')).toBeHidden();
    await expect(header.getByLabel('Search docs')).toBeHidden();

    // Tablet viewport
    await page.setViewportSize({ width: 900, height: 1200 });
    await expect(header.getByLabel('Toggle left panel')).toBeVisible();
    await expect(header.getByLabel('Docs animated icon')).toBeHidden();
    await expect(header.getByLabel('Search docs')).toBeHidden();

    await header.getByLabel('Toggle left panel').click();
    await expect(header.getByLabel('Toggle left panel')).toBeVisible();
    await expect(header.getByLabel('Docs animated icon')).toBeInViewport();
    await expect(header.getByLabel('Search docs')).toBeVisible();

    // scrollDown
    await page.mouse.wheel(0, 1000);

    await expect(header.getByLabel('Toggle left panel')).toBeVisible();
    await expect(header.getByLabel('Docs animated icon')).not.toBeInViewport();
    await expect(header.getByLabel('Search docs')).toBeVisible();

    // Mobile viewport
    await page.setViewportSize({ width: 500, height: 1200 });
    await expect(header.getByLabel('Toggle left panel')).toBeVisible();
    await expect(header.getByLabel('Docs animated icon')).toBeVisible();
    await expect(header.getByLabel('Search docs')).toBeVisible();
  });
});
