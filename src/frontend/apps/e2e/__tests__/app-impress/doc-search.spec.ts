import { expect, test } from '@playwright/test';
import { DateTime } from 'luxon';

import { createDoc, verifyDocName } from './common';

type SmallDoc = {
  id: string;
  title: string;
  updated_at: string;
};

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('Document search', () => {
  test('it checks all elements are visible', async ({ page }) => {
    await page.getByRole('button', { name: 'search' }).click();
    await expect(
      page.getByRole('img', { name: 'No active search' }),
    ).toBeVisible();

    await expect(
      page.getByLabel('Search modal').getByText('search'),
    ).toBeVisible();

    await expect(
      page.getByPlaceholder('Type the name of a document'),
    ).toBeVisible();
  });

  test('it checks search for a document', async ({ page, browserName }) => {
    const id = Math.random().toString(36).substring(7);

    const doc1 = await createDoc(page, `My super ${id} doc`, browserName, 1);
    await verifyDocName(page, doc1[0]);
    await page.goto('/');
    const doc2 = await createDoc(
      page,
      `My super ${id} very doc`,
      browserName,
      1,
    );
    await verifyDocName(page, doc2[0]);
    await page.goto('/');
    await page.getByRole('button', { name: 'search' }).click();
    await page.getByPlaceholder('Type the name of a document').click();
    await page
      .getByPlaceholder('Type the name of a document')
      .fill(`My super ${id}`);

    let responsePromisePage = page.waitForResponse(
      (response) =>
        response.url().includes(`/documents/?page=1&title=My+super+${id}`) &&
        response.status() === 200,
    );
    let response = await responsePromisePage;
    let result = (await response.json()) as { results: SmallDoc[] };
    let docs = result.results;
    expect(docs.length).toEqual(2);

    await Promise.all(
      docs.map(async (doc: SmallDoc) => {
        await expect(
          page.getByTestId(`doc-search-item-${doc.id}`),
        ).toBeVisible();
        const updatedAt = DateTime.fromISO(doc.updated_at ?? DateTime.now())
          .setLocale('en')
          .toRelative();
        await expect(
          page.getByTestId(`doc-search-item-${doc.id}`).getByText(updatedAt!),
        ).toBeVisible();
      }),
    );

    const firstDoc = docs[0];

    await expect(
      page
        .getByTestId(`doc-search-item-${firstDoc.id}`)
        .getByText('keyboard_return'),
    ).toBeVisible();

    await page
      .getByPlaceholder('Type the name of a document')
      .press('ArrowDown');

    const secondDoc = docs[1];
    await expect(
      page
        .getByTestId(`doc-search-item-${secondDoc.id}`)
        .getByText('keyboard_return'),
    ).toBeVisible();

    await page.getByPlaceholder('Type the name of a document').click();
    await page
      .getByPlaceholder('Type the name of a document')
      .fill(`My super ${id} doc`);

    responsePromisePage = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes(`/documents/?page=1&title=My+super+${id}+doc`) &&
        response.status() === 200,
    );

    response = await responsePromisePage;
    result = (await response.json()) as { results: SmallDoc[] };
    docs = result.results;

    expect(docs.length).toEqual(1);
  });
});
