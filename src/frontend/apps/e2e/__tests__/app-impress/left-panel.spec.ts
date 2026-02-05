import { expect, test } from '@playwright/test';

import { createDoc, goToGridDoc, verifyDocName } from './utils-common';

test.describe('Left panel desktop', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('checks all the elements are visible', async ({ page }) => {
    await expect(page.getByTestId('left-panel-desktop')).toBeVisible();
    await expect(page.getByTestId('left-panel-mobile')).toBeHidden();
    await expect(page.getByTestId('home-button')).toBeHidden();
    await expect(page.getByTestId('new-doc-button')).toBeVisible();

    await goToGridDoc(page);

    await expect(page.getByTestId('home-button')).toBeVisible();
  });

  test('focuses main content after switching the docs filter', async ({
    page,
  }) => {
    await page.goto('/');

    const myDocsLink = page.getByRole('link', { name: 'My docs' });
    await myDocsLink.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/target=my_docs/);

    const mainContent = page.locator('main#mainContent');
    await expect(mainContent).toBeFocused();
  });

  test('checks resize handle is present and functional on document page', async ({
    page,
    browserName,
  }) => {
    // On home page, resize handle should NOT be present
    let resizeHandle = page.locator('[data-panel-resize-handle-id]');
    await expect(resizeHandle).toBeHidden();

    // Create and navigate to a document
    await createDoc(page, 'doc-resize-test', browserName, 1);

    // Now resize handle should be visible on document page
    resizeHandle = page.locator('[data-panel-resize-handle-id]').first();
    await expect(resizeHandle).toBeVisible();

    const leftPanel = page.getByTestId('left-panel-desktop');
    await expect(leftPanel).toBeVisible();

    // Get initial panel width
    const initialBox = await leftPanel.boundingBox();
    expect(initialBox).not.toBeNull();

    // Get handle position
    const handleBox = await resizeHandle.boundingBox();
    expect(handleBox).not.toBeNull();

    // Test resize by dragging the handle
    await page.mouse.move(
      handleBox!.x + handleBox!.width / 2,
      handleBox!.y + handleBox!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      handleBox!.x + 100,
      handleBox!.y + handleBox!.height / 2,
    );
    await page.mouse.up();

    // Wait for resize to complete
    await page.waitForTimeout(200);

    // Verify the panel has been resized
    const newBox = await leftPanel.boundingBox();
    expect(newBox).not.toBeNull();
    expect(newBox!.width).toBeGreaterThan(initialBox!.width);
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
    const homeButton = page.getByTestId('home-button');
    const newDocButton = page.getByTestId('new-doc-button');
    const languageButton = page.getByRole('button', {
      name: 'Select language',
    });
    const logoutButton = page.getByRole('button', { name: 'Logout' });

    await expect(homeButton).not.toBeInViewport();
    await expect(newDocButton).not.toBeInViewport();
    await expect(languageButton).not.toBeInViewport();
    await expect(logoutButton).not.toBeInViewport();

    const title = await goToGridDoc(page);
    await verifyDocName(page, title);

    await header.getByLabel('Open the header menu').click();

    await expect(page.getByTestId('left-panel-mobile')).toBeInViewport();
    await expect(homeButton).toBeInViewport();
    await expect(newDocButton).toBeInViewport();
    await expect(languageButton).toBeInViewport();
    await expect(logoutButton).toBeInViewport();
  });

  test('checks resize handle is not present on mobile', async ({ page }) => {
    await page.goto('/');

    // Verify the resize handle is NOT present on mobile
    const resizeHandle = page.locator('[data-panel-resize-handle-id]');
    await expect(resizeHandle).toBeHidden();
  });
});
