import { expect, test } from '@playwright/test';

import { createDoc, verifyDocName } from './utils-common';
import { updateShareLink } from './utils-share';
import { createRootSubPage } from './utils-sub-pages';

test.describe('Inherited share accesses', () => {
  test('it checks inherited accesses', async ({ page, browserName }) => {
    await page.goto('/');
    const [parentTitle] = await createDoc(page, 'root-doc', browserName, 1);

    // Wait for and intercept the POST request to create a new page
    await createRootSubPage(page, browserName, 'sub-page');

    await page.getByRole('button', { name: 'Share' }).click();
    await expect(
      page.getByText('People with access via the parent document'),
    ).toBeVisible();

    const user = page.getByTestId(
      `doc-share-member-row-user@${browserName}.test`,
    );
    await expect(user).toBeVisible();
    await expect(user.getByText('E2E Chromium')).toBeVisible();
    await expect(user.getByText('Owner')).toBeVisible();

    await page
      .locator('.--docs--doc-inherited-share-content')
      .getByRole('link')
      .click();

    await verifyDocName(page, parentTitle);
  });
});

test.describe('Inherited share link', () => {
  test('it checks if the link is inherited', async ({ page, browserName }) => {
    await page.goto('/');
    // Create root doc
    await createDoc(page, 'root-doc', browserName, 1);

    // Update share link
    await page.getByRole('button', { name: 'Share' }).click();
    await updateShareLink(page, 'Connected', 'Reading');
    await page.getByRole('button', { name: 'OK' }).click();

    // Create sub page
    await createRootSubPage(page, browserName, 'sub-page');

    // // verify share link is restricted and reader
    await page.getByRole('button', { name: 'Share' }).click();
    // await expect(page.getByText('Inherited share')).toBeVisible();
    const docVisibilityCard = page.getByLabel('Doc visibility card');
    await expect(docVisibilityCard).toBeVisible();
    await expect(docVisibilityCard.getByText('Connected')).toBeVisible();
    await expect(docVisibilityCard.getByText('Reading')).toBeVisible();
  });
});
