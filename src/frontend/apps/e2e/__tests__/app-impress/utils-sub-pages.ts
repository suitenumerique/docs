import { Page, expect } from '@playwright/test';

import {
  BrowserName,
  randomName,
  updateDocTitle,
  verifyDocName,
  waitForResponseCreateDoc,
} from './utils-common';

export const createRootSubPage = async (
  page: Page,
  browserName: BrowserName,
  docName: string,
  isMobile = false,
) => {
  if (isMobile) {
    await page
      .getByRole('button', { name: 'Open the header menu' })
      .getByText('menu')
      .click();
  }

  // Get response
  const responsePromise = waitForResponseCreateDoc(page);
  await clickOnAddRootSubPage(page);
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  const subPageJson = (await response.json()) as { id: string };

  if (isMobile) {
    await page
      .getByRole('button', { name: 'Open the header menu' })
      .getByText('menu')
      .click();
  }

  // Get doc tree
  const docTree = page.getByTestId('doc-tree');
  await expect(docTree).toBeVisible();

  // Get sub page item
  const subPageItem = docTree
    .getByTestId(`doc-sub-page-item-${subPageJson.id}`)
    .first();
  await expect(subPageItem).toBeVisible();
  await subPageItem.click();

  if (isMobile) {
    await page
      .getByRole('button', { name: 'Open the header menu' })
      .getByText('close')
      .click();
  }

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
  await rootItem.getByTestId('doc-tree-item-actions-add-child').click();
};

export const addChild = async ({
  page,
  browserName,
  docParent,
  docName,
}: {
  page: Page;
  browserName: BrowserName;
  docParent: string;
  docName: string;
}) => {
  let item = page.getByTestId('doc-tree-root-item');

  const isParent = await item
    .filter({
      hasText: docParent,
    })
    .first()
    .count();

  if (!isParent) {
    const items = page.getByRole('treeitem');

    item = items
      .filter({
        hasText: docParent,
      })
      .first();
  }

  await item.hover();
  await item.getByTestId('doc-tree-item-actions-add-child').click();

  const [name] = randomName(docName, browserName, 1);
  await updateDocTitle(page, name);

  return name;
};

export const getTreeRow = async (page: Page, title: string) => {
  const docTree = page.getByTestId('doc-tree');
  const row = docTree
    .getByRole('treeitem')
    .filter({
      hasText: title,
    })
    .first();

  await expect(row).toBeVisible();

  return row;
};

export const navigateToTopParentFromTree = async ({ page }: { page: Page }) => {
  await page.getByRole('link', { name: /Open root document/ }).click();
};

export const navigateToPageFromTree = async ({
  page,
  title,
}: {
  page: Page;
  title: string;
}) => {
  const docTree = page.getByTestId('doc-tree');
  await docTree
    .getByText(title, {
      exact: true,
    })
    .click();
  await verifyDocName(page, title);
};
