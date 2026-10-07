import { expect, test } from '@playwright/test';

import { createDoc, verifyDocName } from './utils-common';
import { getEditor, openSuggestionMenu } from './utils-editor';
import { addChild, navigateToPageFromTree } from './utils-sub-pages';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('Doc Editor - Children block', () => {
  test('it lists the sub-docs of the doc and follows the tree', async ({
    page,
    browserName,
  }) => {
    const [parentTitle] = await createDoc(
      page,
      'children-block-parent',
      browserName,
      1,
    );
    await verifyDocName(page, parentTitle);

    await openSuggestionMenu({ page, suggestion: 'Sub-docs list' });

    const editor = await getEditor({ page });
    await expect(editor.getByText('No sub-docs yet')).toBeVisible();

    const firstChild = await addChild({
      page,
      browserName,
      docParent: parentTitle,
      docName: 'children-block-first',
    });
    await navigateToPageFromTree({ page, title: parentTitle });

    const secondChild = await addChild({
      page,
      browserName,
      docParent: parentTitle,
      docName: 'children-block-second',
    });
    await navigateToPageFromTree({ page, title: parentTitle });

    const links = page.locator('.--docs--doc-children').getByRole('link');
    await expect(links).toHaveCount(2);
    await expect(links.nth(0)).toContainText(firstChild);
    await expect(links.nth(1)).toContainText(secondChild);

    await links.nth(1).click();
    await verifyDocName(page, secondChild);
  });
});
