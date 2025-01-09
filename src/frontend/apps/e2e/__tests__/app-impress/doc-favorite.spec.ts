import { expect, test } from '@playwright/test';

import { createDoc, verifyDocName } from './common';

type SmallDoc = {
  id: string;
  title: string;
};

test.describe('Document favorite', () => {
  test('it check the favorite workflow', async ({ page, browserName }) => {
    const id = Math.random().toString(7);
    await page.goto('/');

    // Create document
    const createdDoc = await createDoc(page, `Doc ${id}`, browserName, 1);
    await verifyDocName(page, createdDoc[0]);

    // Reload page
    await page.reload();
    await page.goto('/');

    // Get all documents
    let docs: SmallDoc[] = [];
    const response = await page.waitForResponse(
      (response) =>
        response.url().endsWith('documents/?page=1') &&
        response.status() === 200,
    );
    const result = await response.json();
    docs = result.results as SmallDoc[];
    const docsGrid = page.getByTestId('docs-grid');
    await docsGrid.getByRole('heading', { name: 'All docs' }).click();
    await expect(docsGrid.getByText(`Doc ${id}`)).toBeVisible();
    const doc = docs.find((doc) => doc.title === createdDoc[0]) as SmallDoc;

    // Check document
    expect(doc).not.toBeUndefined();
    expect(doc?.title).toBe(createdDoc[0]);

    // Open document actions
    const button = docsGrid.getByTestId(`docs-grid-actions-button-${doc.id}`);
    await expect(button).toBeVisible();
    await button.click();

    // Pin document
    const pinButton = page.getByTestId(`docs-grid-actions-pin-${docs[0].id}`);
    await expect(pinButton).toBeVisible();
    await pinButton.click();

    // Check response
    const responsePin = await page.waitForResponse(
      (response) =>
        response.url().includes(`documents/${doc.id}/favorite/`) &&
        response.status() === 201,
    );
    expect(responsePin.ok()).toBeTruthy();

    // Check left panel favorites
    const leftPanelFavorites = page.getByTestId('left-panel-favorites');
    await expect(leftPanelFavorites).toBeVisible();
    await expect(leftPanelFavorites.getByText(`Doc ${id}`)).toBeVisible();

    //
    await button.click();
    const unpinButton = page.getByTestId(
      `docs-grid-actions-unpin-${docs[0].id}`,
    );
    await expect(unpinButton).toBeVisible();
    await unpinButton.click();

    // Check left panel favorites
    await expect(leftPanelFavorites.getByText(`Doc ${id}`)).toBeHidden();
  });
});
