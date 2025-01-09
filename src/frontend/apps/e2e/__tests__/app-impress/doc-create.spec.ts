import { expect, test } from '@playwright/test';

import { createDoc } from './common';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('Doc Create', () => {
  test('it creates a doc', async ({ page, browserName }) => {
    const [docTitle] = await createDoc(page, 'My new doc', browserName, 1);

    await page.waitForFunction(
      () => document.title.match(/My new doc - Docs/),
      { timeout: 5000 },
    );

    const header = page.locator('header').first();
    await header.locator('h2').getByText('Docs').click();

    await expect(page.getByTestId('grid-loader')).toBeVisible();

    const docsGrid = page.getByTestId('docs-grid');
    await expect(docsGrid).toBeVisible();
    await expect(page.getByTestId('grid-loader')).toBeHidden();
    await expect(docsGrid.getByText(docTitle)).toBeVisible();
  });
});
