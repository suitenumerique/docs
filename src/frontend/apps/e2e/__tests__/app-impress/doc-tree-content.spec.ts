/* eslint-disable playwright/no-conditional-in-test */
import { expect, test } from '@playwright/test';

import { createDoc } from './common';

test.describe('Doc Tree', () => {
  test('create new sub pages', async ({ page, browserName }) => {
    await page.goto('/');
    await createDoc(page, 'doc-tree-content', browserName, 1);
    const addButton = page.getByRole('button', { name: 'New page' });
    const docTree = page.getByTestId('doc-tree');

    await expect(addButton).toBeVisible();

    // Attendre et intercepter la requête POST pour créer une nouvelle page
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/documents/') &&
        response.url().includes('/children/') &&
        response.request().method() === 'POST',
    );

    await addButton.click();
    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();
    const subPageJson = await response.json();

    await expect(docTree).toBeVisible();
    const subPageItem = docTree
      .getByTestId(`doc-sub-page-item-${subPageJson.id}`)
      .first();

    await expect(subPageItem).toBeVisible();
    await subPageItem.click();
    const input = page.getByRole('textbox', { name: 'doc title input' });
    await input.click();
    await input.fill('Test');
    await input.press('Enter');
    await expect(subPageItem.getByText('Test')).toBeVisible();
    await page.reload();
    await expect(subPageItem.getByText('Test')).toBeVisible();
  });

  test('check the reorder of sub pages', async ({ page, browserName }) => {
    await page.goto('/');
    await createDoc(page, 'doc-tree-content', browserName, 1);
    const addButton = page.getByRole('button', { name: 'New page' });
    await expect(addButton).toBeVisible();

    const docTree = page.getByTestId('doc-tree');

    // Create first sub page
    const firstResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/documents/') &&
        response.url().includes('/children/') &&
        response.request().method() === 'POST',
    );

    await addButton.click();
    const firstResponse = await firstResponsePromise;
    expect(firstResponse.ok()).toBeTruthy();

    const secondResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/documents/') &&
        response.url().includes('/children/') &&
        response.request().method() === 'POST',
    );

    // Create second sub page
    await addButton.click();
    const secondResponse = await secondResponsePromise;
    expect(secondResponse.ok()).toBeTruthy();

    const secondSubPageJson = await secondResponse.json();
    const firstSubPageJson = await firstResponse.json();

    const firstSubPageItem = docTree
      .getByTestId(`doc-sub-page-item-${firstSubPageJson.id}`)
      .first();

    const secondSubPageItem = docTree
      .getByTestId(`doc-sub-page-item-${secondSubPageJson.id}`)
      .first();

    // check that the sub pages are visible in the tree
    await expect(firstSubPageItem).toBeVisible();
    await expect(secondSubPageItem).toBeVisible();

    // get the bounding boxes of the sub pages
    const firstSubPageBoundingBox = await firstSubPageItem.boundingBox();
    const secondSubPageBoundingBox = await secondSubPageItem.boundingBox();

    expect(firstSubPageBoundingBox).toBeDefined();
    expect(secondSubPageBoundingBox).toBeDefined();

    if (!firstSubPageBoundingBox || !secondSubPageBoundingBox) {
      throw new Error('Impossible de déterminer la position des éléments');
    }

    // move the first sub page to the second position
    await page.mouse.move(
      firstSubPageBoundingBox.x + firstSubPageBoundingBox.width / 2,
      firstSubPageBoundingBox.y + firstSubPageBoundingBox.height / 2,
    );

    await page.mouse.down();

    await page.mouse.move(
      secondSubPageBoundingBox.x + secondSubPageBoundingBox.width / 2,
      secondSubPageBoundingBox.y + secondSubPageBoundingBox.height + 4,
      { steps: 10 },
    );

    await page.mouse.up();

    // check that the sub pages are visible in the tree
    await expect(firstSubPageItem).toBeVisible();
    await expect(secondSubPageItem).toBeVisible();

    // reload the page
    await page.reload();

    // check that the sub pages are visible in the tree
    await expect(firstSubPageItem).toBeVisible();
    await expect(secondSubPageItem).toBeVisible();

    // Check the position of the sub pages
    const allSubPageItems = await docTree
      .getByTestId(/^doc-sub-page-item/)
      .all();

    expect(allSubPageItems.length).toBe(2);

    // Vérifier que le premier élément a l'ID de la deuxième sous-page après le drag and drop

    await expect(allSubPageItems[0]).toHaveAttribute(
      'data-testid',
      `doc-sub-page-item-${secondSubPageJson.id}`,
    );

    // Vérifier que le deuxième élément a l'ID de la première sous-page après le drag and drop
    await expect(allSubPageItems[1]).toHaveAttribute(
      'data-testid',
      `doc-sub-page-item-${firstSubPageJson.id}`,
    );
  });
});
