import { expect, test } from '@playwright/test';

import { createDoc, verifyDocName } from './utils-common';
import { createRootSubPage } from './utils-sub-pages';

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
    await page.getByTestId('search-docs-button').click();

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

  test('it check the presence of filters in search modal', async ({
    page,
    browserName,
  }) => {
    // Doc grid filters are not visible
    const searchButton = page.getByTestId('search-docs-button');

    const filters = page.getByTestId('doc-search-filters');

    await searchButton.click();
    await expect(
      page.getByRole('combobox', { name: 'Quick search input' }),
    ).toBeVisible();
    await expect(filters).toBeHidden();

    await page.getByRole('button', { name: 'close' }).click();

    // Create a doc without children for the moment
    // and check that filters are not visible
    const [doc1Title] = await createDoc(page, 'My page search', browserName, 1);
    await verifyDocName(page, doc1Title);

    await searchButton.click();
    await expect(
      page.getByRole('combobox', { name: 'Quick search input' }),
    ).toBeVisible();
    await expect(filters).toBeHidden();

    await page.getByRole('button', { name: 'close' }).click();

    // Create a sub page
    // and check that filters are visible
    await createRootSubPage(page, browserName, 'My sub page search');

    await searchButton.click();

    await expect(filters).toBeVisible();

    await filters.click();
    await filters.getByRole('button', { name: 'Current doc' }).click();
    await expect(
      page.getByRole('menuitem', { name: 'All docs' }),
    ).toBeVisible();
    await expect(
      page.getByRole('menuitem', { name: 'Current doc' }),
    ).toBeVisible();
    await page.getByRole('menuitem', { name: 'All docs' }).click();

    await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible();
  });

  test('it searches sub pages', async ({ page, browserName }) => {
    // First doc
    const [firstDocTitle] = await createDoc(
      page,
      'My first sub page search',
      browserName,
      1,
    );
    await verifyDocName(page, firstDocTitle);

    // Create a new doc - for the moment without children
    const [secondDocTitle] = await createDoc(
      page,
      'My second sub page search',
      browserName,
      1,
    );

    const searchButton = page.getByTestId('search-docs-button');

    await searchButton.click();
    await page.getByRole('combobox', { name: 'Quick search input' }).click();
    await page
      .getByRole('combobox', { name: 'Quick search input' })
      .fill('sub page search');

    // Expect to find the first doc
    await expect(
      page.getByRole('presentation').getByLabel(firstDocTitle),
    ).toBeVisible();
    await expect(
      page.getByRole('presentation').getByLabel(secondDocTitle),
    ).toBeVisible();

    await page.getByRole('button', { name: 'close' }).click();

    // Create a sub page
    const { name: secondChildDocTitle } = await createRootSubPage(
      page,
      browserName,
      'second - Child doc',
    );
    await searchButton.click();
    await page
      .getByRole('combobox', { name: 'Quick search input' })
      .fill('second');

    // Now there is a sub page - expect to have the focus on the current doc
    await expect(
      page.getByRole('presentation').getByLabel(secondDocTitle),
    ).toBeVisible();
    await expect(
      page.getByRole('presentation').getByLabel(secondChildDocTitle),
    ).toBeVisible();
    await expect(
      page.getByRole('presentation').getByLabel(firstDocTitle),
    ).toBeHidden();
  });
});
