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

    const link1 = elSidePanel.getByRole('link', { name: 'Level 1' });
    const link2 = elSidePanel.getByRole('link', { name: 'Level 2' });
    const link3 = elSidePanel.getByRole('link', { name: 'Level 3' });
    const level1 = link1.getByText('Level 1');
    const editorLevel1 = editor.getByText('Level 1');
    const level2 = link2.getByText('Level 2');
    const editorLevel2 = editor.getByText('Level 2');
    const level3 = link3.getByText('Level 3');

    // TOC entries must be <a> links with fragment hrefs pointing to block ids
    await expect(link1).toBeVisible();
    await expect(link1).toHaveAttribute('href', /^#.+/);
    await expect(link2).toHaveAttribute('href', /^#.+/);
    await expect(link3).toHaveAttribute('href', /^#.+/);

    await expect(level1).toBeVisible();
    await expect(editorLevel1).not.toBeInViewport();
    await expect(link1).not.toHaveAttribute('aria-current');

    await expect(level2).toBeVisible();
    await expect(level2).toHaveCSS('padding-left', /14.4px/);
    await expect(editorLevel2).toBeInViewport();
    await expect(link2).toHaveAttribute('aria-current', 'true');

    await expect(level3).toBeVisible();
    await expect(level3).toHaveCSS('padding-left', /24px/);
    await expect(link3).not.toHaveAttribute('aria-current');

    await link1.click();
    await expect(editorLevel1).toBeInViewport();
    await expect(link1).toHaveAttribute('aria-current', 'true');
    await expect(link2).not.toHaveAttribute('aria-current');

    await link2.click();
    await expect(editorLevel1).not.toBeInViewport();
    await expect(editorLevel2).toBeInViewport();
    await expect(link2).toHaveAttribute('aria-current', 'true');
    await expect(link1).not.toHaveAttribute('aria-current');
  });
});
