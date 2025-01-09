import { expect, test } from '@playwright/test';

import { createDoc, verifyDocName } from './common';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('Doc Table Content', () => {
  test('it checks the doc table content', async ({ page, browserName }) => {
    test.setTimeout(60000);

    const [randomDoc] = await createDoc(
      page,
      'doc-table-content',
      browserName,
      1,
    );

    await verifyDocName(page, randomDoc);

    await page.locator('.ProseMirror').click();

    await page.keyboard.type('# Level 1\n## Level 2\n### Level 3');

    const summaryContainer = page.locator('#summaryContainer');
    await summaryContainer.click();

    const level1 = summaryContainer.getByText('Level 1');
    const level2 = summaryContainer.getByText('Level 2');
    const level3 = summaryContainer.getByText('Level 3');

    await expect(level1).toBeVisible();
    await expect(level1).toHaveCSS('padding', /4px 0px/);
    await expect(level1).toHaveAttribute('aria-selected', 'true');

    await expect(level2).toBeVisible();
    await expect(level2).toHaveCSS('padding-left', /14.4px/);
    await expect(level2).toHaveAttribute('aria-selected', 'false');

    await expect(level3).toBeVisible();
    await expect(level3).toHaveCSS('padding-left', /24px/);
    await expect(level3).toHaveAttribute('aria-selected', 'false');
  });
});
