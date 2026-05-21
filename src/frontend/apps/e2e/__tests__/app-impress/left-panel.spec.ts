import { expect, test } from '@playwright/test';

import { createDoc, goToGridDoc, verifyDocName } from './utils-common';
import { tryFocusEditorContent } from './utils-editor';
import { createRootSubPage } from './utils-sub-pages';

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

  test('focuses page heading after switching the docs filter', async ({
    page,
  }) => {
    await page.goto('/');

    const myDocsLink = page.getByRole('link', { name: 'My docs' });
    await myDocsLink.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/target=my_docs/);

    const pageHeading = page.getByRole('heading', {
      name: 'My docs',
      level: 2,
    });
    await expect(pageHeading).toBeFocused();
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

test.describe('Left panel responsive', () => {
  test('checks elements visibility on different screen sizes', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 500, height: 1200 });
    await page.goto('/');

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

    await header.getByLabel('Close the header menu').click();

    // Tablet size - like in desktop, left panel should be visible
    await page.setViewportSize({ width: 900, height: 1200 });
    await page.goto('/');

    await expect(page.getByRole('link', { name: 'All docs' })).toBeInViewport();
    await expect(newDocButton).toBeInViewport();
    await expect(languageButton).toBeInViewport();
    await expect(logoutButton).toBeInViewport();
    await expect(header.getByLabel('Open the header menu')).toBeHidden();
  });

  test('checks panel closes when clicking on a subdoc', async ({
    page,
    browserName,
  }) => {
    await page.setViewportSize({ width: 500, height: 1200 });
    await page.goto('/');

    const [docTitle] = await createDoc(
      page,
      'mobile-doc-test',
      browserName,
      1,
      true,
    );

    const { name: docChild } = await createRootSubPage(
      page,
      browserName,
      'mobile-doc-test-child',
      true,
    );

    const { name: docChild2 } = await createRootSubPage(
      page,
      browserName,
      'mobile-doc-test-child-2',
      true,
    );

    const header = page.locator('header').first();
    await header.getByLabel('Open the header menu').click();

    await expect(page.getByTestId('left-panel-mobile')).toBeInViewport();

    const docTree = page.getByTestId('doc-tree');
    await expect(docTree.getByText(docTitle)).toBeVisible();
    await expect(docTree.getByText(docChild)).toBeVisible();
    await expect(docTree.getByText(docChild2)).toBeVisible();

    await docTree.getByText(docChild).click();
    await verifyDocName(page, docChild);
    await expect(page.getByTestId('left-panel-mobile')).not.toBeInViewport();
  });

  test('checks panel coordination on tablet sizes', async ({
    page,
    browserName,
  }) => {
    await page.setViewportSize({ width: 900, height: 1200 });
    await page.goto('/');

    await createDoc(page, 'tablet-doc-test', browserName, 1);

    const leftPanel = page.locator('.--docs--resizable-left-panel');
    const rightPanel = page.getByLabel('Table of contents side panel');

    // Initially, left panel should be visible and right panel should be hidden
    await expect(leftPanel).toBeInViewport();
    await expect(rightPanel).not.toBeInViewport();
    await tryFocusEditorContent({ page });
    await page.keyboard.type('# Level 1');

    // Open right panel, the left panel should hide
    await page
      .getByRole('button', { name: 'Show the table of contents sidebar' })
      .click();
    await expect(rightPanel).toBeInViewport();
    await expect(leftPanel).toBeHidden();

    // Open left panel, the right panel should hide
    await page.getByRole('button', { name: /Show the side panel/ }).click();
    await expect(leftPanel).toBeInViewport();
    await expect(rightPanel).not.toBeInViewport();

    // Close the left panel, the right panel should show
    await page.getByRole('button', { name: /Hide the side panel/ }).click();
    await expect(leftPanel).toBeHidden();
    await expect(rightPanel).toBeInViewport();

    // Close right panel, the left panel should stay closed
    await page
      .getByRole('button', { name: 'Hide the table of contents sidebar' })
      .click();
    await expect(rightPanel).not.toBeInViewport();
    await expect(leftPanel).toBeHidden();
  });
});
