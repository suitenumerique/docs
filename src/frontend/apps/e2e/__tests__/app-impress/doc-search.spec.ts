import { expect, test } from '@playwright/test';

import { createDoc, randomName, verifyDocName } from './common';
import { createRootSubPage } from './sub-pages-utils';

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
    await page
      .getByTestId('left-panel-desktop')
      .getByRole('button', { name: 'search' })
      .click();

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

  test("it checks we don't see filters in search modal", async ({ page }) => {
    const searchButton = page
      .getByTestId('left-panel-desktop')
      .getByRole('button', { name: 'search' });

    await expect(searchButton).toBeVisible();
    await page.getByRole('button', { name: 'search', exact: true }).click();
    await expect(
      page.getByRole('combobox', { name: 'Quick search input' }),
    ).toBeVisible();
    await expect(page.getByTestId('doc-search-filters')).toBeHidden();
  });
});

test.describe('Sub page search', () => {
  test('it check the presence of filters in search modal', async ({
    page,
    browserName,
  }) => {
    await page.goto('/');
    const [doc1Title] = await createDoc(
      page,
      'My sub page search',
      browserName,
      1,
    );
    await verifyDocName(page, doc1Title);
    const searchButton = page
      .getByTestId('left-panel-desktop')
      .getByRole('button', { name: 'search', exact: true });
    await searchButton.click();
    const filters = page.getByTestId('doc-search-filters');
    await expect(filters).toBeVisible();
    await filters.click();
    await filters.getByRole('button', { name: 'All docs' }).click();
    await expect(
      page.getByRole('menuitem', { name: 'All docs' }),
    ).toBeVisible();
    await expect(
      page.getByRole('menuitem', { name: 'Current doc' }),
    ).toBeVisible();
    await page.getByRole('menuitem', { name: 'Current doc' }).click();

    await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible();

    await page.getByRole('button', { name: 'close' }).click();

    await createRootSubPage(page, browserName, 'My sub page search');

    await searchButton.click();
    await expect(
      filters.getByRole('button', { name: 'Current doc' }),
    ).toBeVisible();
  });

  test('it searches sub pages', async ({ page, browserName }) => {
    await page.goto('/');

    // First doc
    const [firstDocTitle] = await createDoc(
      page,
      'My first sub page search',
      browserName,
      1,
    );
    await verifyDocName(page, firstDocTitle);

    // Create a new doc - for the moment without children
    await page.getByRole('button', { name: 'New doc' }).click();
    await verifyDocName(page, '');
    await page.getByRole('textbox', { name: 'doc title input' }).click();
    await page
      .getByRole('textbox', { name: 'doc title input' })
      .press('ControlOrMeta+a');
    const [secondDocTitle] = randomName(
      'My second sub page search',
      browserName,
      1,
    );
    await page
      .getByRole('textbox', { name: 'doc title input' })
      .fill(secondDocTitle);

    const searchButton = page
      .getByTestId('left-panel-desktop')
      .getByRole('button', { name: 'search' });

    await searchButton.click();
    await expect(page.getByRole('button', { name: 'All docs' })).toBeVisible();
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
    await createRootSubPage(page, browserName, secondDocTitle);
    await searchButton.click();
    await page
      .getByRole('combobox', { name: 'Quick search input' })
      .fill('sub page search');

    // Now there is a sub page - expect to have the focus on the current doc
    await expect(
      page.getByRole('presentation').getByLabel(secondDocTitle),
    ).toBeVisible();
    await expect(
      page.getByRole('presentation').getByLabel(firstDocTitle),
    ).toBeHidden();
  });
});
