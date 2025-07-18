import { Page, expect } from '@playwright/test';

import {
  randomName,
  updateDocTitle,
  waitForResponseCreateDoc,
} from './utils-common';

export const createRootSubPage = async (
  page: Page,
  browserName: string,
  docName: string,
) => {
  // Get response
  const responsePromise = waitForResponseCreateDoc(page);
  await clickOnAddRootSubPage(page);
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  const subPageJson = (await response.json()) as { id: string };

  // Get doc tree
  const docTree = page.getByTestId('doc-tree');
  await expect(docTree).toBeVisible();

  // Get sub page item
  const subPageItem = docTree
    .getByTestId(`doc-sub-page-item-${subPageJson.id}`)
    .first();
  await expect(subPageItem).toBeVisible();
  await subPageItem.click();

  // Update sub page name
  const randomDocs = randomName(docName, browserName, 1);
  await updateDocTitle(page, randomDocs[0]);

  // Return sub page data
  return { name: randomDocs[0], docTreeItem: subPageItem, item: subPageJson };
};

export const clickOnAddRootSubPage = async (page: Page) => {
  const rootItem = page.getByTestId('doc-tree-root-item');
  await expect(rootItem).toBeVisible();
  await rootItem.hover();
  await rootItem.getByRole('button', { name: 'add_box' }).click();
};
