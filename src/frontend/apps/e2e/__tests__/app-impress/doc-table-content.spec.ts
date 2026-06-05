import { expect, test } from '@playwright/test';

import { createDoc } from './utils-common';
import { tryFocusEditorContent } from './utils-editor';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('Doc Table Content', () => {
  test('it checks the doc table content', async ({ page, browserName }) => {
    await createDoc(page, 'doc-table-content', browserName, 1);

    await expect(
      page.getByRole('button', { name: 'Show the table of contents sidebar' }),
    ).toBeHidden();

    const editor = await tryFocusEditorContent({ page });
    await page.keyboard.type('# Level 1');
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Enter');
    }
    await page.keyboard.type('## Level 2');
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Enter');
    }
    await page.keyboard.type('### Level 3');

    await page
      .getByRole('button', { name: 'Show the table of contents sidebar' })
      .click();

    const elSidePanel = page.getByLabel('Table of contents side panel');

    const level1 = elSidePanel.getByText('Level 1');
    const editorLevel1 = editor.getByText('Level 1');
    const level2 = elSidePanel.getByText('Level 2');
    const editorLevel2 = editor.getByText('Level 2');
    const level3 = elSidePanel.getByText('Level 3');

    await expect(level1).toBeVisible();
    await expect(editorLevel1).not.toBeInViewport();
    await expect(level1).toHaveAttribute('aria-selected', 'false');

    await expect(level2).toBeVisible();
    await expect(level2).toHaveCSS('padding-left', /14.4px/);
    await expect(editorLevel2).toBeInViewport();
    await expect(level2).toHaveAttribute('aria-selected', 'true');

    await expect(level3).toBeVisible();
    await expect(level3).toHaveCSS('padding-left', /24px/);
    await expect(level3).toHaveAttribute('aria-selected', 'false');

    await level1.click();
    await expect(editorLevel1).toBeInViewport();
    await expect(level1).toHaveAttribute('aria-selected', 'true');
    await expect(level2).toHaveAttribute('aria-selected', 'false');

    await level2.click();
    await expect(editorLevel1).not.toBeInViewport();
    await expect(editorLevel2).toBeInViewport();
    await expect(level2).toHaveAttribute('aria-selected', 'true');
    await expect(level1).toHaveAttribute('aria-selected', 'false');
  });
});
