import { expect, test } from '@playwright/test';

import { createDoc, verifyDocName } from './common';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('Document search', () => {
  test('it searches documents', async ({ page, browserName }) => {
    const [doc1Title] = await createDoc(
      page,
      'My doc search super',
      browserName,
      1,
    );
    await verifyDocName(page, doc1Title);
    await page.goto('/');

    const [doc2Title] = await createDoc(
      page,
      'My doc search doc',
      browserName,
      1,
    );
    await verifyDocName(page, doc2Title);
    await page.goto('/');
    await page.getByRole('button', { name: 'search' }).click();

    await expect(
      page.getByRole('img', { name: 'No active search' }),
    ).toBeVisible();

    await expect(
      page.getByLabel('Search modal').getByText('search'),
    ).toBeVisible();

    const inputSearch = page.getByPlaceholder('Type the name of a document');

    await inputSearch.click();
    await inputSearch.fill('My doc search');
    await inputSearch.press('ArrowDown');

    const listSearch = page.getByRole('listbox').getByRole('group');
    const rowdoc = listSearch.getByRole('option').first();
    await expect(rowdoc.getByText('keyboard_return')).toBeVisible();
    await expect(rowdoc.getByText(/seconds? ago/)).toBeVisible();

    await expect(
      listSearch.getByRole('option').getByText(doc1Title),
    ).toBeVisible();
    await expect(
      listSearch.getByRole('option').getByText(doc2Title),
    ).toBeVisible();

    await inputSearch.fill('My doc search super');

    await expect(
      listSearch.getByRole('option').getByText(doc1Title),
    ).toBeVisible();

    await expect(
      listSearch.getByRole('option').getByText(doc2Title),
    ).toBeHidden();
  });

  test('it checks cmd+k modal search interaction', async ({
    page,
    browserName,
  }) => {
    const [doc1Title] = await createDoc(
      page,
      'Doc seack ctrl k',
      browserName,
      1,
    );
    await verifyDocName(page, doc1Title);

    await page.keyboard.press('Control+k');
    await expect(
      page.getByLabel('Search modal').getByText('search'),
    ).toBeVisible();

    await page.keyboard.press('Escape');

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await editor.fill('Hello world');
    await editor.getByText('Hello world').selectText();

    await page.keyboard.press('Control+k');
    await expect(page.getByRole('textbox', { name: 'Edit URL' })).toBeVisible();
    await expect(
      page.getByLabel('Search modal').getByText('search'),
    ).toBeHidden();
  });
});
