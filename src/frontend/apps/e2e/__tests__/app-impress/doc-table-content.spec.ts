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

    const editor = page.locator('.ProseMirror');

    await editor.locator('.bn-block-outer').last().fill('/');

    await page.getByText('Heading 1').click();
    await page.keyboard.type('Level 1');
    await editor.getByText('Level 1').dblclick();
    await page.getByRole('button', { name: 'Strike' }).click();

    await page.locator('.bn-block-outer').first().click();
    await editor.click();
    await page.locator('.bn-block-outer').last().click();

    // Create space to fill the viewport
    for (let i = 0; i < 2; i++) {
      await page.keyboard.press('Enter');
    }

    await editor.locator('.bn-block-outer').last().fill('/');
    await page.getByText('Heading 2').click();
    await page.keyboard.type('Level 2');

    await page.locator('.bn-block-outer').last().click();

    // Create space to fill the viewport
    for (let i = 0; i < 2; i++) {
      await page.keyboard.press('Enter');
    }

    await editor.locator('.bn-block-outer').last().fill('/');
    await page.getByText('Heading 3').click();
    await page.keyboard.type('Level 3');

    expect(true).toBe(true);

    const summaryContainer = page.locator('#summaryContainer');
    await summaryContainer.hover();

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
