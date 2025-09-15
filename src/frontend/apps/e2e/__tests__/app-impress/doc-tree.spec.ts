import { expect, test } from '@playwright/test';

import {
  createDoc,
  expectLoginPage,
  keyCloakSignIn,
  randomName,
  updateDocTitle,
  verifyDocName,
} from './utils-common';
import { addNewMember } from './utils-share';
import {
  clickOnAddRootSubPage,
  createRootSubPage,
  getTreeRow,
} from './utils-sub-pages';

test.describe('Doc Tree', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('create new sub pages', async ({ page, browserName }) => {
    const [titleParent] = await createDoc(
      page,
      'doc-tree-content',
      browserName,
      1,
    );
    await verifyDocName(page, titleParent);
    const addButton = page.getByTestId('new-doc-button');
    const docTree = page.getByTestId('doc-tree');

    await expect(addButton).toBeVisible();

    // Wait for and intercept the POST request to create a new page
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/documents/') &&
        response.url().includes('/children/') &&
        response.request().method() === 'POST',
    );

    await clickOnAddRootSubPage(page);
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
    const input = page.getByRole('textbox', { name: 'Document title' });
    await input.click();
    const [randomDocName] = randomName('doc-tree-test', browserName, 1);
    await input.fill(randomDocName);
    await input.press('Enter');
    await expect(subPageItem.getByText(randomDocName)).toBeVisible();
    await page.reload();
    await expect(subPageItem.getByText(randomDocName)).toBeVisible();
  });

  test('check the reorder of sub pages', async ({ page, browserName }) => {
    await createDoc(page, 'doc-tree-content', browserName, 1);
    const addButton = page.getByTestId('new-doc-button');
    await expect(addButton).toBeVisible();

    const docTree = page.getByTestId('doc-tree');

    // Create first sub page
    const firstResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/documents/') &&
        response.url().includes('/children/') &&
        response.request().method() === 'POST',
    );

    await clickOnAddRootSubPage(page);
    const firstResponse = await firstResponsePromise;
    expect(firstResponse.ok()).toBeTruthy();
    await updateDocTitle(page, 'first');

    const secondResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/documents/') &&
        response.url().includes('/children/') &&
        response.request().method() === 'POST',
    );

    // Create second sub page
    await clickOnAddRootSubPage(page);
    const secondResponse = await secondResponsePromise;
    expect(secondResponse.ok()).toBeTruthy();
    await updateDocTitle(page, 'second');

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
      secondSubPageBoundingBox.y + secondSubPageBoundingBox.height + 2,
      { steps: 20 },
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

  test('it detaches a document', async ({ page, browserName }) => {
    const [docParent] = await createDoc(
      page,
      'doc-tree-detach',
      browserName,
      1,
    );
    await verifyDocName(page, docParent);

    const { name: docChild } = await createRootSubPage(
      page,
      browserName,
      'doc-tree-detach-child',
    );

    const docTree = page.getByTestId('doc-tree');
    await expect(docTree.getByText(docChild)).toBeVisible();
    await docTree.click();
    const child = docTree
      .getByRole('treeitem')
      .locator('.--docs-sub-page-item')
      .filter({
        hasText: docChild,
      });
    await child.hover();
    const menu = child.getByText(`more_horiz`);
    await menu.click();
    await page.getByText('Move to my docs').click();

    await expect(
      page.getByRole('textbox', { name: 'Document title' }),
    ).not.toHaveText(docChild);

    const header = page.locator('header').first();
    await header.locator('h1').getByText('Docs').click();
    await expect(page.getByText(docChild)).toBeVisible();
  });

  test('Only owner can detaches a document', async ({ page, browserName }) => {
    const [docParent] = await createDoc(
      page,
      'doc-tree-detach',
      browserName,
      1,
    );

    await verifyDocName(page, docParent);

    await page.getByRole('button', { name: 'Share' }).click();

    await addNewMember(page, 0, 'Owner', 'impress');

    const list = page.getByTestId('doc-share-quick-search');
    const currentUser = list.getByTestId(
      `doc-share-member-row-user.test@${browserName}.test`,
    );
    const currentUserRole = currentUser.getByLabel('doc-role-dropdown');
    await currentUserRole.click();
    await page.getByRole('menuitem', { name: 'Administrator' }).click();
    await list.click();

    await page.getByRole('button', { name: 'Ok' }).click();

    const { name: docChild } = await createRootSubPage(
      page,
      browserName,
      'doc-tree-detach-child',
    );

    await expect(
      page
        .getByLabel('It is the card information about the document.')
        .getByText('Administrator ·'),
    ).toBeVisible();

    const docTree = page.getByTestId('doc-tree');
    await expect(docTree.getByText(docChild)).toBeVisible();
    await docTree.click();
    const child = docTree
      .getByRole('treeitem')
      .locator('.--docs-sub-page-item')
      .filter({
        hasText: docChild,
      });
    await child.hover();
    const menu = child.getByText(`more_horiz`);
    await menu.click();

    await expect(
      page.getByRole('menuitem', { name: 'Move to my docs' }),
    ).toHaveAttribute('aria-disabled', 'true');
  });

  test('keyboard navigation with Enter key opens documents', async ({
    page,
    browserName,
  }) => {
    // Create a parent document
    const [docParent] = await createDoc(
      page,
      'doc-tree-keyboard-nav',
      browserName,
      1,
    );
    await verifyDocName(page, docParent);

    // Create a sub-document
    const { name: docChild } = await createRootSubPage(
      page,
      browserName,
      'doc-tree-keyboard-child',
    );

    const docTree = page.getByTestId('doc-tree');
    await expect(docTree).toBeVisible();

    // Test keyboard navigation on root document
    const rootItem = page.getByTestId('doc-tree-root-item');
    await expect(rootItem).toBeVisible();

    // Focus on the root item and press Enter
    await rootItem.focus();
    await expect(rootItem).toBeFocused();
    await page.keyboard.press('Enter');

    // Verify we navigated to the root document
    await verifyDocName(page, docParent);
    await expect(page).toHaveURL(/\/docs\/[^/]+\/?$/);

    // Now test keyboard navigation on sub-document
    await expect(docTree.getByText(docChild)).toBeVisible();
  });

  test('it updates the child icon from the tree', async ({
    page,
    browserName,
  }) => {
    const [docParent] = await createDoc(
      page,
      'doc-child-emoji',
      browserName,
      1,
    );
    await verifyDocName(page, docParent);

    const { name: docChild } = await createRootSubPage(
      page,
      browserName,
      'doc-child-emoji-child',
    );

    // Update the emoji from the tree
    const row = await getTreeRow(page, docChild);
    await row.locator('.--docs--doc-icon').click();
    await page.getByRole('button', { name: '😀' }).first().click();

    // Verify the emoji is updated in the tree and in the document title
    await expect(row.getByText('😀')).toBeVisible();
    await expect(
      page.getByRole('textbox', { name: 'Document title' }),
    ).toContainText('😀');
  });
});

test.describe('Doc Tree: Inheritance', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('A child inherit from the parent', async ({ page, browserName }) => {
    // test.slow() to extend timeout since this scenario chains Keycloak login + redirects,
    // doc creation/navigation and async doc-tree loading (/documents/:id/tree), which can exceed 30s (especially in CI).
    test.slow();

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
    const selectVisibility = page.getByTestId('doc-visibility');
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

    const { name: docChild } = await createRootSubPage(
      page,
      browserName,
      'doc-tree-inheritance-child',
    );

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
    await expect(docTree).toBeVisible({ timeout: 10000 });
    await expect(docTree.getByText(docParent)).toBeVisible();
  });
});
