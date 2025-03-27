/* eslint-disable playwright/no-conditional-in-test */
import { expect, test } from '@playwright/test';

import {
  createDoc,
  expectLoginPage,
  keyCloakSignIn,
  randomName,
  verifyDocName,
} from './common';

test.describe('Doc Tree', () => {
  test('create new sub pages', async ({ page, browserName }) => {
    await page.goto('/');
    const [titleParent] = await createDoc(
      page,
      'doc-tree-content',
      browserName,
      1,
    );
    await verifyDocName(page, titleParent);
    const addButton = page.getByRole('button', { name: 'New page' });
    const docTree = page.getByTestId('doc-tree');

    await expect(addButton).toBeVisible();

    // Wait for and intercept the POST request to create a new page
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
    await verifyDocName(page, '');
    const input = page.getByRole('textbox', { name: 'doc title input' });
    await input.click();
    const [randomDocName] = randomName('doc-tree-test', browserName, 1);
    await input.fill(randomDocName);
    await input.press('Enter');
    await expect(subPageItem.getByText(randomDocName)).toBeVisible();
    await page.reload();
    await expect(subPageItem.getByText(randomDocName)).toBeVisible();
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

    // Check that the first element has the ID of the second sub page after the drag and drop
    await expect(allSubPageItems[0]).toHaveAttribute(
      'data-testid',
      `doc-sub-page-item-${secondSubPageJson.id}`,
    );

    // Check that the second element has the ID of the first sub page after the drag and drop
    await expect(allSubPageItems[1]).toHaveAttribute(
      'data-testid',
      `doc-sub-page-item-${firstSubPageJson.id}`,
    );
  });

  test('it detachs a document', async ({ page, browserName }) => {
    await page.goto('/');
    const [docParent] = await createDoc(
      page,
      'doc-tree-detach',
      browserName,
      1,
    );
    await verifyDocName(page, docParent);

    const [docChild] = await createDoc(
      page,
      'doc-tree-detach-child',
      browserName,
      1,
      true,
    );
    await verifyDocName(page, docChild);

    const docTree = page.getByTestId('doc-tree');
    const child = docTree
      .getByRole('treeitem')
      .locator('.--docs-sub-page-item')
      .filter({
        hasText: docChild,
      });
    await child.hover();
    const menu = child.getByText(`more_horiz`);
    await menu.click();
    await page.getByText('Convert to doc').click();

    await expect(
      page.getByRole('textbox', { name: 'doc title input' }),
    ).not.toHaveText(docChild);

    const header = page.locator('header').first();
    await header.locator('h2').getByText('Docs').click();
    await expect(page.getByText(docChild)).toBeVisible();
  });
});

test.describe('Doc Tree: Inheritance', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('A child inherit from the parent', async ({ page, browserName }) => {
    await page.goto('/');
    await keyCloakSignIn(page, browserName);

    const [docParent] = await createDoc(
      page,
      'doc-tree-inheritance-parent',
      browserName,
      1,
    );
    await verifyDocName(page, docParent);

    await page.getByRole('button', { name: 'Share' }).click();
    const selectVisibility = page.getByLabel('Visibility', { exact: true });
    await selectVisibility.click();

    await page
      .getByRole('menuitem', {
        name: 'Public',
      })
      .click();

    await expect(
      page.getByText('The document visibility has been updated.'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'close' }).click();

    const [docChild] = await createDoc(
      page,
      'doc-tree-inheritance-child',
      browserName,
      1,
      true,
    );
    await verifyDocName(page, docChild);

    const urlDoc = page.url();

    await page
      .getByRole('button', {
        name: 'Logout',
      })
      .click();

    await expectLoginPage(page);

    await page.goto(urlDoc);

    await expect(page.locator('h2').getByText(docChild)).toBeVisible();

    const docTree = page.getByTestId('doc-tree');
    await expect(docTree.getByText(docParent)).toBeVisible();
  });

  test('Do not show private parent from children', async ({
    page,
    browserName,
  }) => {
    await page.goto('/');
    await keyCloakSignIn(page, browserName);

    const [docParent] = await createDoc(
      page,
      'doc-tree-inheritance-private-parent',
      browserName,
      1,
    );
    await verifyDocName(page, docParent);

    const [docChild] = await createDoc(
      page,
      'doc-tree-inheritance-private-child',
      browserName,
      1,
      true,
    );
    await verifyDocName(page, docChild);

    await page.getByRole('button', { name: 'Share' }).click();
    const selectVisibility = page.getByLabel('Visibility', { exact: true });
    await selectVisibility.click();

    await page
      .getByRole('menuitem', {
        name: 'Public',
      })
      .click();

    await expect(
      page.getByText('The document visibility has been updated.'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'close' }).click();

    const urlDoc = page.url();

    await page
      .getByRole('button', {
        name: 'Logout',
      })
      .click();

    await expectLoginPage(page);

    await page.goto(urlDoc);

    await expect(page.locator('h2').getByText(docChild)).toBeVisible();

    const docTree = page.getByTestId('doc-tree');
    await expect(docTree.getByText(docParent)).toBeHidden();
  });
});
