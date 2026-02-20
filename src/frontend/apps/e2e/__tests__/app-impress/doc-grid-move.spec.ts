import { expect, test } from '@playwright/test';

import {
  createDoc,
  getGridRow,
  getOtherBrowserName,
  mockedListDocs,
  toggleHeaderMenu,
  verifyDocName,
} from './utils-common';
import { addNewMember } from './utils-share';
import { createRootSubPage } from './utils-sub-pages';

test.describe('Doc grid move', () => {
  test('it checks drag and drop functionality', async ({
    page,
    browserName,
  }) => {
    await page.goto('/');
    const header = page.locator('header').first();
    await createDoc(page, 'Draggable doc', browserName, 1);
    await header.locator('h1').getByText('Docs').click();
    await createDoc(page, 'Droppable doc', browserName, 1);
    await header.locator('h1').getByText('Docs').click();

    const response = await page.waitForResponse(
      (response) =>
        response.url().endsWith('documents/?page=1') &&
        response.status() === 200,
    );
    const responseJson = await response.json();

    const items = responseJson.results;

    const docsGrid = page.getByTestId('docs-grid');
    await expect(docsGrid).toBeVisible();
    await expect(page.getByTestId('grid-loader')).toBeHidden();
    const draggableElement = page.getByTestId(`draggable-doc-${items[1].id}`);
    const dropZone = page.getByTestId(`droppable-doc-${items[0].id}`);
    await expect(draggableElement).toBeVisible();
    await expect(dropZone).toBeVisible();

    // Get the position of the elements
    const draggableBoundingBox = await draggableElement.boundingBox();
    const dropZoneBoundingBox = await dropZone.boundingBox();

    expect(draggableBoundingBox).toBeDefined();
    expect(dropZoneBoundingBox).toBeDefined();

    if (!draggableBoundingBox || !dropZoneBoundingBox) {
      throw new Error('Unable to determine the position of the elements');
    }

    await page.mouse.move(
      draggableBoundingBox.x + draggableBoundingBox.width / 2,
      draggableBoundingBox.y + draggableBoundingBox.height / 2,
    );
    await page.mouse.down();

    // Move to the target zone
    await page.mouse.move(
      dropZoneBoundingBox.x + dropZoneBoundingBox.width / 2,
      dropZoneBoundingBox.y + dropZoneBoundingBox.height / 2,
      { steps: 10 }, // Make the movement smoother
    );

    const dragOverlay = page.getByTestId('drag-doc-overlay');

    await expect(dragOverlay).toBeVisible();
    await expect(dragOverlay).toHaveText(items[1].title as string);
    await page.mouse.up();

    await expect(dragOverlay).toBeHidden();
  });

  test("it checks can't drop when we have not the minimum role", async ({
    page,
  }) => {
    await mockedListDocs(page, data);
    await page.goto('/');
    const docsGrid = page.getByTestId('docs-grid');
    await expect(docsGrid).toBeVisible();
    await expect(page.getByTestId('grid-loader')).toBeHidden();

    const canDropAndDrag = page.getByTestId('droppable-doc-can-drop-and-drag');

    const noDropAndNoDrag = page.getByTestId(
      'droppable-doc-no-drop-and-no-drag',
    );

    await expect(canDropAndDrag).toBeVisible();

    await expect(noDropAndNoDrag).toBeVisible();

    const canDropAndDragBoundigBox = await canDropAndDrag.boundingBox();

    const noDropAndNoDragBoundigBox = await noDropAndNoDrag.boundingBox();

    if (!canDropAndDragBoundigBox || !noDropAndNoDragBoundigBox) {
      throw new Error('Unable to determine the position of the elements');
    }

    await page.mouse.move(
      canDropAndDragBoundigBox.x + canDropAndDragBoundigBox.width / 2,
      canDropAndDragBoundigBox.y + canDropAndDragBoundigBox.height / 2,
    );

    await page.mouse.down();

    await page.mouse.move(
      noDropAndNoDragBoundigBox.x + noDropAndNoDragBoundigBox.width / 2,
      noDropAndNoDragBoundigBox.y + noDropAndNoDragBoundigBox.height / 2,
      { steps: 10 },
    );

    const dragOverlay = page.getByTestId('drag-doc-overlay');

    await expect(dragOverlay).toBeVisible();
    await expect(dragOverlay).toHaveText(
      'You must be at least the administrator of the target document',
    );

    await page.mouse.up();
  });

  test("it checks can't drag when we have not the minimum role", async ({
    page,
  }) => {
    await mockedListDocs(page, data);
    await page.goto('/');
    const docsGrid = page.getByTestId('docs-grid');
    await expect(docsGrid).toBeVisible();
    await expect(page.getByTestId('grid-loader')).toBeHidden();

    const canDropAndDrag = page.getByTestId('droppable-doc-can-drop-and-drag');

    const noDropAndNoDrag = page.getByTestId(
      'droppable-doc-no-drop-and-no-drag',
    );

    await expect(canDropAndDrag).toBeVisible();

    await expect(noDropAndNoDrag).toBeVisible();

    const canDropAndDragBoundigBox = await canDropAndDrag.boundingBox();

    const noDropAndNoDragBoundigBox = await noDropAndNoDrag.boundingBox();

    if (!canDropAndDragBoundigBox || !noDropAndNoDragBoundigBox) {
      throw new Error('Unable to determine the position of the elements');
    }

    await page.mouse.move(
      noDropAndNoDragBoundigBox.x + noDropAndNoDragBoundigBox.width / 2,
      noDropAndNoDragBoundigBox.y + noDropAndNoDragBoundigBox.height / 2,
    );

    await page.mouse.down();

    await page.mouse.move(
      canDropAndDragBoundigBox.x + canDropAndDragBoundigBox.width / 2,
      canDropAndDragBoundigBox.y + canDropAndDragBoundigBox.height / 2,
      { steps: 10 },
    );

    const dragOverlay = page.getByTestId('drag-doc-overlay');

    await expect(dragOverlay).toBeVisible();
    await expect(dragOverlay).toHaveText(
      'You must be the owner to move the document',
    );

    await page.mouse.up();
  });

  test('it moves a doc from the doc search modal', async ({
    page,
    browserName,
  }) => {
    await page.goto('/');

    const [titleDoc1] = await createDoc(page, 'Draggable doc', browserName, 1);

    const otherBrowserName = getOtherBrowserName(browserName);
    await page.getByRole('button', { name: 'Share' }).click();
    await addNewMember(page, 0, 'Administrator', otherBrowserName);
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'close' })
      .click();

    await page.getByRole('button', { name: 'Back to homepage' }).click();

    const [titleDoc2] = await createDoc(page, 'Droppable doc', browserName, 1);
    await page.getByRole('button', { name: 'Back to homepage' }).click();

    const docsGrid = page.getByTestId('docs-grid');
    await expect(docsGrid.getByText(titleDoc1)).toBeVisible();
    await expect(docsGrid.getByText(titleDoc2)).toBeVisible();

    const row = await getGridRow(page, titleDoc1);
    await row.getByText(`more_horiz`).click();

    await page.getByRole('menuitem', { name: 'Move into a doc' }).click();

    await expect(
      page.getByRole('dialog').getByRole('heading', { name: 'Move' }),
    ).toBeVisible();

    const input = page.getByRole('combobox', { name: 'Quick search input' });
    await input.click();
    await input.fill(titleDoc2);

    await expect(page.getByRole('option').getByText(titleDoc2)).toBeVisible();

    // Select the first result
    await page.keyboard.press('Enter');
    // The CTA should get the focus
    await page.keyboard.press('Tab');
    // Validate the move action
    await page.keyboard.press('Enter');

    await expect(
      page
        .getByRole('dialog')
        .getByText('it will lose its current access rights'),
    ).toBeVisible();

    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Move', exact: true })
      .first()
      .click();

    await expect(docsGrid.getByText(titleDoc1)).toBeHidden();
    await docsGrid
      .getByRole('link', { name: `Open document ${titleDoc2}` })
      .click();

    await verifyDocName(page, titleDoc2);

    const docTree = page.getByTestId('doc-tree');
    await expect(docTree.getByText(titleDoc1)).toBeVisible();
  });
});

test.describe('Doc grid dnd mobile', () => {
  test.use({ viewport: { width: 500, height: 1200 } });

  test('DND is deactivated on mobile', async ({ page, browserName }) => {
    await page.goto('/');

    const docsGrid = page.getByTestId('docs-grid');
    await expect(page.getByTestId('docs-grid')).toBeVisible();
    await expect(page.getByTestId('grid-loader')).toBeHidden();

    await expect(docsGrid.getByRole('row').first()).toBeVisible();
    await expect(docsGrid.locator('.--docs--grid-droppable')).toHaveCount(0);

    await createDoc(page, 'Draggable doc mobile', browserName, 1, true);

    await createRootSubPage(
      page,
      browserName,
      'Draggable doc mobile child',
      true,
    );

    await toggleHeaderMenu(page);

    await expect(page.locator('.--docs-sub-page-item').first()).toHaveAttribute(
      'draggable',
      'false',
    );
  });
});

const data = [
  {
    id: 'can-drop-and-drag',
    abilities: {
      accesses_manage: true,
      accesses_view: true,
      ai_transform: true,
      ai_translate: true,
      attachment_upload: true,
      children_list: true,
      children_create: true,
      collaboration_auth: true,
      descendants: true,
      destroy: true,
      favorite: true,
      link_configuration: true,
      invite_owner: true,
      move: true,
      partial_update: true,
      restore: true,
      retrieve: true,
      media_auth: true,
      link_select_options: {
        restricted: ['reader', 'editor'],
        authenticated: ['reader', 'editor'],
        public: ['reader', 'editor'],
      },
      tree: true,
      update: true,
      versions_destroy: true,
      versions_list: true,
      versions_retrieve: true,
    },
    created_at: '2025-03-14T14:45:22.527221Z',
    creator: 'bc6895e0-8f6d-4b00-827d-c143aa6b2ecb',
    depth: 1,
    excerpt: null,
    is_favorite: false,
    link_role: 'reader',
    link_reach: 'restricted',
    nb_accesses_ancestors: 1,
    nb_accesses_direct: 1,
    numchild: 5,
    path: '000000o',
    title: 'Can drop and drag',
    updated_at: '2025-03-14T14:45:27.699542Z',
    user_roles: ['owner'],
    user_role: 'owner',
  },
  {
    id: 'can-only-drop',
    title: 'Can only drop',
    abilities: {
      accesses_manage: true,
      accesses_view: true,
      ai_transform: true,
      ai_translate: true,
      attachment_upload: true,
      children_list: true,
      children_create: true,
      collaboration_auth: true,
      descendants: true,
      destroy: true,
      favorite: true,
      link_configuration: true,
      invite_owner: true,
      move: true,
      partial_update: true,
      restore: true,
      retrieve: true,
      media_auth: true,
      link_select_options: {
        restricted: ['reader', 'editor'],
        authenticated: ['reader', 'editor'],
        public: ['reader', 'editor'],
      },
      tree: true,
      update: true,
      versions_destroy: true,
      versions_list: true,
      versions_retrieve: true,
    },
    created_at: '2025-03-14T14:45:22.527221Z',
    creator: 'bc6895e0-8f6d-4b00-827d-c143aa6b2ecb',
    depth: 1,
    excerpt: null,
    is_favorite: false,
    link_role: 'reader',
    link_reach: 'restricted',
    nb_accesses_ancestors: 1,
    nb_accesses_direct: 1,
    numchild: 5,
    path: '000000o',

    updated_at: '2025-03-14T14:45:27.699542Z',
    user_roles: ['editor'],
    user_role: 'editor',
  },
  {
    id: 'no-drop-and-no-drag',
    abilities: {
      accesses_manage: false,
      accesses_view: true,
      ai_transform: false,
      ai_translate: false,
      attachment_upload: false,
      children_list: true,
      children_create: false,
      collaboration_auth: true,
      descendants: true,
      destroy: false,
      favorite: true,
      link_configuration: false,
      invite_owner: false,
      move: false,
      partial_update: false,
      restore: false,
      retrieve: true,
      media_auth: true,
      link_select_options: {
        restricted: ['reader', 'editor'],
        authenticated: ['reader', 'editor'],
        public: ['reader', 'editor'],
      },
      tree: true,
      update: false,
      versions_destroy: false,
      versions_list: true,
      versions_retrieve: true,
    },
    created_at: '2025-03-14T14:44:16.032773Z',
    creator: '9264f420-f018-4bd6-96ae-4788f41af56d',
    depth: 1,
    excerpt: null,
    is_favorite: false,
    link_role: 'reader',
    link_reach: 'restricted',
    nb_accesses_ancestors: 14,
    nb_accesses_direct: 14,
    numchild: 0,
    path: '000000l',
    title: 'No drop and no drag',
    updated_at: '2025-03-14T14:44:16.032774Z',
    user_roles: ['reader'],
    user_role: 'reader',
  },
];
