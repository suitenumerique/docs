import { expect, test } from '@playwright/test';

import {
  clickInEditorMenu,
  clickInGridMenu,
  createDoc,
  getGridRow,
  verifyDocName,
} from './utils-common';
import { addNewMember } from './utils-share';
import {
  addChild,
  createRootSubPage,
  navigateToPageFromTree,
} from './utils-sub-pages';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('Doc Trashbin', () => {
  test('it controls UI and interaction from the grid page', async ({
    page,
    browserName,
  }) => {
    const [title1] = await createDoc(page, 'my-trash-doc-1', browserName, 1);
    const [title2] = await createDoc(page, 'my-trash-doc-2', browserName, 1);
    await verifyDocName(page, title2);
    await page.getByRole('button', { name: 'Share' }).click();
    await addNewMember(page, 0, 'Editor');
    await page.getByRole('button', { name: 'close' }).click();

    await page.getByRole('button', { name: 'Back to homepage' }).click();

    // Delete the first document - Is not displayed
    const row1 = await getGridRow(page, title1);
    await clickInGridMenu(page, row1, 'Delete');
    await page.getByRole('button', { name: 'Delete document' }).click();
    await expect(row1.getByText(title1)).toBeHidden();

    // Star the second document - Is displayed in the starred list
    const row2 = await getGridRow(page, title2);
    await clickInGridMenu(page, row2, 'Star');
    await page.getByRole('link', { name: 'Starred', exact: true }).click();
    await expect(row2.getByText(title2)).toBeVisible();

    // Delete the second document - It is not displayed in the starred list anymore
    await clickInGridMenu(page, row2, 'Delete');
    await page.getByRole('button', { name: 'Delete document' }).click();
    await expect(row2.getByText(title2)).toBeHidden();

    // It is displayed in the trashbin list
    await page.getByRole('link', { name: 'Trashbin' }).click();
    const docsGrid = page.getByTestId('docs-grid');
    await expect(row2.getByText(title2)).toBeVisible();
    await expect(docsGrid.getByText('Days remaining')).toBeVisible();

    try {
      await expect(row1.getByText(title1)).toBeVisible();
    } catch {
      test.skip(
        true,
        'We skip this test, it will fails because too much document deleted in the trashbin and it is ordered by day remaining',
      );
    }

    await expect(row1.getByText('30 days')).toBeVisible();

    try {
      await expect(row2.getByText(title2)).toBeVisible();
    } catch {
      test.skip(
        true,
        'We skip this test, it will fails because too much document deleted in the trashbin and it is ordered by day remaining',
      );
    }

    await expect(
      row2.getByRole('button', {
        name: 'Open the sharing settings for the document',
      }),
    ).toBeVisible();
    await expect(
      row2.getByRole('button', {
        name: 'Open the sharing settings for the document',
      }),
    ).toBeDisabled();

    await clickInGridMenu(page, row2, 'Restore');

    await expect(row2.getByText(title2)).toBeHidden();

    // It is displayed in the starred list again
    await page.getByRole('link', { name: 'Starred', exact: true }).click();
    await expect(row2.getByText(title2)).toBeVisible();

    // It is displayed in the recent list again
    await page.getByRole('link', { name: 'Recent' }).click();
    const row2Restored = await getGridRow(page, title2);
    await expect(row2Restored.getByText(title2)).toBeVisible();
    await row2Restored.getByRole('link', { name: /Open document/ }).click();

    await verifyDocName(page, title2);
    await page.getByRole('button', { name: 'Back to homepage' }).click();
    await expect(row2.getByText(title2)).toBeVisible();
    await expect(
      row2.getByRole('button', {
        name: 'Open the sharing settings for the document',
      }),
    ).toBeEnabled();

    await page.getByRole('link', { name: 'Trashbin' }).click();
    await expect(row2.getByText(title2)).toBeHidden();
  });

  test('it controls UI and interaction from the doc page', async ({
    page,
    browserName,
  }) => {
    const [topParent] = await createDoc(
      page,
      'my-trash-editor-doc',
      browserName,
      1,
    );
    const { name: subDocName } = await createRootSubPage(
      page,
      browserName,
      'my-trash-editor-subdoc',
    );

    const subsubDocName = await addChild({
      page,
      browserName,
      docParent: subDocName,
      docName: 'my-trash-editor-subsubdoc',
    });
    await verifyDocName(page, subsubDocName);

    await navigateToPageFromTree({ page, title: subDocName });
    await verifyDocName(page, subDocName);
    const docsGrid = page.getByTestId('docs-grid');

    await clickInEditorMenu(page, 'Star');
    await page.getByRole('button', { name: 'Back to homepage' }).click();
    await page.getByRole('link', { name: 'Starred', exact: true }).click();
    await expect(docsGrid.getByText(subDocName)).toBeVisible();
    await page.getByText(subDocName).click();
    await verifyDocName(page, subDocName);

    await clickInEditorMenu(page, 'Delete');
    await page.getByRole('button', { name: 'Delete document' }).click();
    await verifyDocName(page, topParent);

    await page.getByRole('button', { name: 'Back to homepage' }).click();
    await expect(docsGrid.getByText(subDocName)).toBeHidden();
    await page.getByRole('link', { name: 'Trashbin' }).click();

    let row;
    try {
      row = await getGridRow(page, subDocName);
    } catch {
      test.skip(
        true,
        'We skip this test, it will fails because too much document deleted in the trashbin and it is ordered by day remaining',
      );
    }

    await row?.getByText(subDocName).click();
    await verifyDocName(page, subDocName);

    await expect(
      page.locator('.--docs--editor-container.--docs--doc-deleted'),
    ).toBeVisible();

    await expect(page.getByLabel('Alert deleted document')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Share' })).toBeHidden();
    await expect(page.locator('.bn-editor')).toHaveAttribute(
      'contenteditable',
      'false',
    );
    const docTree = page.getByTestId('doc-tree');
    await expect(docTree.getByText(topParent)).toBeHidden();
    await expect(
      docTree.getByText(subDocName, {
        exact: true,
      }),
    ).toBeVisible();
    await expect(docTree.getByText(subsubDocName)).toBeVisible();
    await expect(
      docTree
        .locator(".--docs-sub-page-item[aria-disabled='true']")
        .getByText(subsubDocName),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Restore' }).click();
    await expect(page.getByLabel('Alert deleted document')).toBeHidden();
    await expect(page.locator('.bn-editor')).toHaveAttribute(
      'contenteditable',
      'true',
    );
    await expect(page.getByRole('button', { name: 'Share' })).toBeEnabled();
    await expect(docTree.getByText(topParent)).toBeVisible();
    await page.getByRole('button', { name: 'Back to homepage' }).click();
    await page.getByRole('link', { name: 'Starred', exact: true }).click();
    await expect(docsGrid.getByText(subDocName)).toBeVisible();
  });
});
