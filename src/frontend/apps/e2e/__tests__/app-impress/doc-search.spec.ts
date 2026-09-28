import { expect, test } from '@playwright/test';

import { createDoc, verifyDocName } from './utils-common';
import { connectOtherUserToDoc, updateShareLink } from './utils-share';
import {
  createRootSubPage,
  navigateToTopParentFromTree,
} from './utils-sub-pages';

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
      page.getByRole('listbox', { name: 'Suggestions' }).locator('img'),
    ).toBeVisible();

    await expect(
      page.getByRole('heading', { name: 'Search for a document' }),
    ).toBeVisible();

    const inputSearch = page.getByPlaceholder('Type the name of a document');

    await inputSearch.click();
    await inputSearch.fill('My doc search');
    await inputSearch.press('ArrowDown');

    const listSearch = page.getByRole('listbox').getByRole('group');
    const rowdoc = listSearch.getByRole('option').first();
    await expect(rowdoc.getByText(/just now/)).toBeVisible();

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
      page.getByRole('heading', { name: 'Search for a document' }),
    ).toBeVisible();

    await page.keyboard.press('Escape');

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await editor.fill('Hello world');
    await editor.getByText('Hello world').selectText();

    await page.keyboard.press('Control+k');
    await expect(page.getByRole('textbox', { name: 'Edit URL' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Search for a document' }),
    ).toBeHidden();
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
    await page
      .getByRole('combobox', { name: 'Type the name of a document' })
      .fill('sub page');

    // Expect to find the first and second docs in the results list
    const resultsList = page.getByRole('listbox');
    await expect(
      resultsList.getByRole('option', { name: firstDocTitle }),
    ).toBeVisible();
    await expect(
      resultsList.getByRole('option', { name: secondDocTitle }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'close' }).click();

    // Create a sub page
    const { name: secondChildDocTitle } = await createRootSubPage(
      page,
      browserName,
      'My second sub page search - Child doc',
    );
    await searchButton.click();
    await page
      .getByRole('combobox', { name: 'Type the name of a document' })
      .fill('sub page');

    // Display only current doc results
    const updatedResultsList = page.getByRole('listbox');
    // Top parent are not displayed - only children
    await expect(
      updatedResultsList.getByRole('option', { name: secondDocTitle }),
    ).toBeHidden();
    await expect(
      updatedResultsList.getByRole('option', { name: secondChildDocTitle }),
    ).toBeVisible();
    // Breadcrumb not displayed
    await expect(
      updatedResultsList
        .getByRole('option', { name: secondChildDocTitle })
        .getByText(secondDocTitle),
    ).toBeHidden();
    await expect(
      updatedResultsList.getByRole('option', { name: firstDocTitle }),
    ).toBeHidden();

    // Click on the filter to show all docs
    await page
      .getByRole('switch', { name: 'Search in all documents' })
      .getByText('All docs')
      .click();

    // Expect to see all docs in the results list
    await expect(
      updatedResultsList.getByRole('option', { name: firstDocTitle }),
    ).toBeVisible();
    await expect(
      updatedResultsList.getByRole('option', { name: secondDocTitle }),
    ).toBeVisible();
    await expect(
      updatedResultsList.getByRole('option', { name: secondChildDocTitle }),
    ).toBeVisible();
    // Breadcrumb with top parent is displayed
    await expect(
      updatedResultsList
        .getByRole('option', { name: secondChildDocTitle })
        .getByText(secondDocTitle),
    ).toBeVisible();

    await page.getByRole('button', { name: 'close' }).click();

    // Navigate to the top parent doc and make it public
    await navigateToTopParentFromTree({ page });
    await verifyDocName(page, secondDocTitle);
    await page.locator('[data-test="share-button"]').click();
    await updateShareLink(page, 'Public');
    await page.getByRole('button', { name: 'close' }).click();

    const docUrl = page.url();

    // Another unauthenticated should be able to search in the current doc
    const { otherPage, cleanup } = await connectOtherUserToDoc({
      browserName,
      docUrl,
      docTitle: secondDocTitle,
      withoutSignIn: true,
    });

    await otherPage.getByTestId('search-docs-button').click();
    await otherPage
      .getByRole('combobox', { name: 'Type the name of a document' })
      .fill('sub page');

    // Search only in the current doc
    const otherPageResultsList = otherPage.getByRole('listbox');
    await expect(
      otherPageResultsList.getByRole('option', { name: secondDocTitle }),
    ).toBeHidden();
    await expect(
      otherPageResultsList.getByRole('option', { name: secondChildDocTitle }),
    ).toBeVisible();
    await expect(
      otherPageResultsList.getByRole('option', { name: firstDocTitle }),
    ).toBeHidden();

    // Filter is not displayed because the user is not connected
    const otherPageFilters = otherPage.getByTestId('doc-search-filters');
    await expect(otherPageFilters).toBeHidden();

    await cleanup();
  });
});
