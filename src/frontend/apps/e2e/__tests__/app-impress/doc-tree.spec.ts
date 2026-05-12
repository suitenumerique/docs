import { expect, test } from '@playwright/test';

import {
  createDoc,
  getOtherBrowserName,
  updateDocTitle,
  verifyDocName,
} from './utils-common';
import { addNewMember, connectOtherUserToDoc } from './utils-share';
import {
  addChild,
  clickOnAddRootSubPage,
  createRootSubPage,
  getTreeRow,
} from './utils-sub-pages';

test.describe('Doc Tree', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('check the tree pagination', async ({ page, browserName }) => {
    await page.route(/.*\/documents\/.*\/children\//, async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const pageId = url.searchParams.get('page') ?? '1';

      const response = {
        count: 40,
        next: `${process.env.BASE_API_URL}/documents/anything/children/?page=${parseInt(pageId) + 1}`,
        previous:
          parseInt(pageId) > 1
            ? `${process.env.BASE_API_URL}/documents/anything/children/?page=${parseInt(pageId) - 1}`
            : null,
        results: Array.from({ length: 20 }, (_, i) => ({
          id: `doc-child-${pageId}-${i}`,
          abilities: {
            accesses_manage: true,
            accesses_view: true,
            ai_proxy: true,
            ai_transform: true,
            ai_translate: true,
            attachment_upload: true,
            media_check: true,
            can_edit: true,
            children_list: true,
            children_create: true,
            collaboration_auth: true,
            comment: true,
            content: true,
            cors_proxy: true,
            descendants: true,
            destroy: true,
            duplicate: true,
            favorite: true,
            link_configuration: true,
            invite_owner: true,
            mask: true,
            move: true,
            partial_update: true,
            restore: true,
            retrieve: true,
            media_auth: true,
            link_select_options: {
              restricted: null,
              authenticated: ['reader', 'commenter', 'editor'],
              public: ['reader', 'commenter', 'editor'],
            },
            tree: true,
            update: true,
            versions_destroy: true,
            versions_list: true,
            versions_retrieve: true,
            search: true,
          },
          ancestors_link_reach: 'restricted',
          ancestors_link_role: null,
          computed_link_reach: 'restricted',
          computed_link_role: null,
          created_at: '2026-03-27T14:44:12.398544Z',
          creator: '40d339e9-cd97-4fdc-b65f-0a809c7e2db9',
          deleted_at: null,
          depth: 3,
          excerpt: null,
          is_favorite: false,
          link_role: 'reader',
          link_reach: 'restricted',
          nb_accesses_ancestors: 1,
          nb_accesses_direct: 0,
          numchild: 0,
          path: `000000p00000010000001-${pageId}-${i}`,
          title: `doc-child-${pageId}-${i}`,
          updated_at: '2026-03-27T14:44:26.691903Z',
          user_role: 'owner',
        })),
      };

      if (request.method().includes('GET')) {
        await route.fulfill({
          json: response,
        });
      } else {
        await route.continue();
      }
    });

    const [title] = await createDoc(
      page,
      'doc-tree-pagination',
      browserName,
      1,
    );

    const pageParentUrl = page.url();

    const titleChild = await addChild({
      page,
      browserName,
      docParent: title,
      docName: 'doc-tree-pagination-child',
    });

    await addChild({
      page,
      browserName,
      docParent: titleChild,
      docName: 'doc-tree-pagination-child-2',
    });

    await page.goto(pageParentUrl);

    await verifyDocName(page, title);

    const docTree = page.getByTestId('doc-tree');
    await expect(docTree).toBeVisible();
    await docTree.getByText('keyboard_arrow_right').click();
    await docTree
      .getByRole('link', {
        name: `Open document ${titleChild}`,
      })
      .click();

    await expect(docTree.getByText('doc-child-1-19')).toBeVisible();
    await docTree.getByText('doc-child-1-19').hover();
    await expect(docTree.locator('.c__spinner')).toBeVisible();
    await expect(
      docTree.getByText('doc-child-2-1', {
        exact: true,
      }),
    ).toBeVisible();
  });

  test('check the reorder of sub pages', async ({ page, browserName }) => {
    await createDoc(page, 'doc-tree-content', browserName, 1);

    const docTree = page.getByTestId('doc-tree');

    // Create first sub page
    await clickOnAddRootSubPage(page);
    await updateDocTitle(page, 'first move');

    // Create second sub page
    await clickOnAddRootSubPage(page);
    await updateDocTitle(page, 'second move');

    const firstSubPageItem = docTree.getByText('first move').first();
    const secondSubPageItem = docTree.getByText('second move').first();

    // check that the sub pages are visible in the tree
    await expect(firstSubPageItem).toBeVisible();
    await expect(secondSubPageItem).toBeVisible();

    // Check the position of the sub pages
    const allSubPageItems = docTree.getByTestId(/^doc-sub-page-item/);
    await expect(allSubPageItems).toHaveCount(2);

    // Check that elements are in the correct order
    await expect(allSubPageItems.nth(0).getByText('first move')).toBeVisible();
    await expect(allSubPageItems.nth(1).getByText('second move')).toBeVisible();

    // Will move the first sub page to the second position
    // Use the testId-based locators for bounding box to avoid stale text locators
    const firstSubPageBoundingBox = await allSubPageItems.nth(0).boundingBox();
    const secondSubPageBoundingBox = await allSubPageItems.nth(1).boundingBox();

    expect(firstSubPageBoundingBox).toBeDefined();
    expect(secondSubPageBoundingBox).toBeDefined();

    if (!firstSubPageBoundingBox || !secondSubPageBoundingBox) {
      throw new Error('unable to determine the position of the elements');
    }

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

    // Check that elements are in the correct order
    await expect(allSubPageItems.nth(0).getByText('second move')).toBeVisible();
    await expect(allSubPageItems.nth(1).getByText('first move')).toBeVisible();
  });

  test('it detaches a document', async ({ page, browserName }) => {
    const [docParent] = await createDoc(
      page,
      'doc-tree-detach',
      browserName,
      1,
    );

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
    const menu = child.getByRole('button', { name: /More options/ });
    await menu.click();
    await page.getByText('Move to my docs').click();

    await verifyDocName(page, docParent);

    await page.getByRole('button', { name: 'Back to homepage' }).click();
    await expect(page.getByText(docChild)).toBeVisible();
  });

  test('Only owner can detaches a document', async ({ page, browserName }) => {
    await createDoc(page, 'doc-tree-detach', browserName, 1);

    await page.getByRole('button', { name: 'Share' }).click();

    const otherBrowserName = getOtherBrowserName(browserName);
    await addNewMember(page, 0, 'Owner', otherBrowserName);

    const list = page.getByTestId('doc-share-quick-search');
    const currentEmail =
      process.env[`SIGN_IN_USERNAME_${browserName.toUpperCase()}`] || '';
    const currentUser = list.getByTestId(
      `doc-share-member-row-${currentEmail}`,
    );
    const currentUserRole = currentUser.getByTestId('doc-role-dropdown');
    await currentUserRole.click();
    await page.getByRole('menuitemradio', { name: 'Administrator' }).click();
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
    const menu = child.getByRole('button', { name: /More options/ });
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

  test('keyboard navigation with F2 focuses root actions button', async ({
    page,
    browserName,
  }) => {
    // Create a parent document to initialize the tree
    const [docParent] = await createDoc(
      page,
      'doc-tree-keyboard-f2-root',
      browserName,
      1,
    );
    await verifyDocName(page, docParent);

    const docTree = page.getByTestId('doc-tree');
    await expect(docTree).toBeVisible();

    const rootItem = page.getByTestId('doc-tree-root-item');
    await expect(rootItem).toBeVisible();

    // Focus the root item
    await rootItem.focus();
    await expect(rootItem).toBeFocused();

    // Press F2 → focus should move to the root actions \"More options\" button
    await page.keyboard.press('F2');

    const rootActions = rootItem.locator('.doc-tree-root-item-actions');
    const rootMoreOptionsButton = rootActions.getByRole('button', {
      name: /more options/i,
    });

    await expect(rootMoreOptionsButton).toBeFocused();
  });

  test('Shift+Tab from resize handle returns focus to selected sub-doc', async ({
    page,
    browserName,
  }) => {
    const [docParent] = await createDoc(
      page,
      'doc-tree-shift-tab',
      browserName,
      1,
    );
    await verifyDocName(page, docParent);

    const { name: docChild } = await createRootSubPage(
      page,
      browserName,
      'doc-tree-shift-tab-child',
    );

    const selectedSubDoc = await getTreeRow(page, docChild);
    await expect(selectedSubDoc).toHaveAttribute('aria-selected', 'true');

    await selectedSubDoc.focus();
    await expect(selectedSubDoc).toBeFocused();

    await page.keyboard.press('Tab');

    await expect(page.getByLabel('Open help menu')).toBeFocused();

    await page.keyboard.press('Tab');

    await expect(
      page.locator('[data-panel-resize-handle-id]').first(),
    ).toBeFocused();

    await page.keyboard.press('Shift+Tab');

    await expect(page.getByLabel('Open help menu')).toBeFocused();

    await page.keyboard.press('Shift+Tab');

    await expect(selectedSubDoc).toBeFocused();
  });

  test('it updates the child icon from the tree', async ({
    page,
    browserName,
  }) => {
    await createDoc(page, 'doc-child-emoji', browserName, 1);

    const { name: docChild } = await createRootSubPage(
      page,
      browserName,
      'doc-child-emoji-child',
    );

    const row = await getTreeRow(page, docChild);

    // Check Remove emoji is not present initially
    await row.hover();
    const menu = row.getByRole('button', { name: /More options/ });
    await menu.click();
    await expect(
      page.getByRole('menuitem', { name: 'Remove emoji' }),
    ).toBeHidden();

    // Close the menu
    await page.keyboard.press('Escape');

    await page.waitForTimeout(500);

    // Update the emoji from the tree
    await row.locator('.--docs--doc-icon').click();
    await page.getByRole('button', { name: '😀' }).first().click();

    // Verify the emoji is updated in the tree and in the document title
    await expect(row.getByText('😀')).toBeVisible();

    const titleEmojiPicker = page
      .locator('.--docs--doc-title')
      .getByRole('button');
    await expect(titleEmojiPicker).toHaveText('😀');

    // Now remove the emoji using the new action
    await row.hover();
    await menu.click();
    await page.getByRole('menuitem', { name: 'Remove emoji' }).click();

    await expect(row.getByText('😀')).toBeHidden();
    await expect(titleEmojiPicker).toBeHidden();
  });

  test('A child inherit from the parent', async ({ page, browserName }) => {
    // test.slow() to extend timeout since this scenario chains Keycloak login + redirects,
    // doc creation/navigation and async doc-tree loading (/documents/:id/tree), which can exceed 30s (especially in CI).
    test.slow();

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

    await page.getByRole('menuitemradio', { name: 'Public' }).click();

    await expect(
      page.getByText('The document visibility has been updated.'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'close' }).click();

    const { name: docChild } = await createRootSubPage(
      page,
      browserName,
      'doc-tree-inheritance-child',
    );

    const docUrl = page.url();

    const { otherPage, cleanup } = await connectOtherUserToDoc({
      browserName,
      docUrl,
      withoutSignIn: true,
      docTitle: docChild,
    });

    const docTree = otherPage.getByTestId('doc-tree');
    await expect(docTree).toBeVisible({ timeout: 10000 });
    await expect(docTree.getByText(docParent)).toBeVisible();

    await cleanup();
  });
});
