import { expect, test } from '@playwright/test';

import { createDoc } from './common';
import { updateShareLink } from './share-utils';
import { createRootSubPage } from './sub-pages-utils';

test.describe('Inherited share accesses', () => {
  test('it checks inherited accesses', async ({ page, browserName }) => {
    await page.goto('/');
    await createDoc(page, 'root-doc', browserName, 1);
    const docTree = page.getByTestId('doc-tree');

    // Wait for and intercept the POST request to create a new page
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/documents/') &&
        response.url().includes('/children/') &&
        response.request().method() === 'POST',
    );
    await createRootSubPage(page, browserName, 'sub-page');

    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();
    const subPageJson = await response.json();

    await expect(docTree).toBeVisible();
    const subPageItem = docTree
      .getByTestId(`doc-sub-page-item-${subPageJson.id}`)
      .first();

    await expect(subPageItem).toBeVisible();
    await subPageItem.click();
    await page.getByRole('button', { name: 'Share' }).click();
    await expect(
      page.getByText('People with access via the parent document'),
    ).toBeVisible();

    const user = page.getByTestId(
      `doc-share-member-row-user@${browserName}.e2e`,
    );
    await expect(user).toBeVisible();
    await expect(user.getByText('E2E Chromium')).toBeVisible();
    await expect(user.getByText('Owner')).toBeVisible();
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

  /**
   * These tests are temporarily removed because we hide the ability to modify this parameter in sub-pages for now.
   * There is a high probability that this feature will not change and therefore the test won't either.
   */

  // test('it checks warning message when sharing rules differ', async ({
  //   page,
  //   browserName,
  // }) => {
  //   await page.goto('/');
  //   // Create root doc
  //   await createDoc(page, 'root-doc', browserName, 1);

  //   // Update share link
  //   await page.getByRole('button', { name: 'Share' }).click();
  //   await updateShareLink(page, 'Connected', 'Reading');
  //   await page.getByRole('button', { name: 'OK' }).click();

  //   // Create sub page
  //   await createRootSubPage(page, browserName, 'sub-page');
  //   await page.getByRole('button', { name: 'Share' }).click();

  //   // Update share link to public and edition
  //   await updateShareLink(page, 'Public', 'Edition');
  //   await expect(page.getByText('Sharing rules differ from the')).toBeVisible();
  //   const restoreButton = page.getByRole('button', { name: 'Restore' });
  //   await expect(restoreButton).toBeVisible();
  //   await restoreButton.click();
  //   await expect(
  //     page.getByText('The document visibility has been updated').first(),
  //   ).toBeVisible();
  //   await expect(page.getByText('Sharing rules differ from the')).toBeHidden();
  // });

  // test('it checks inherited link possibilities', async ({
  //   page,
  //   browserName,
  // }) => {
  //   await page.goto('/');
  //   // Create root doc
  //   await createDoc(page, 'root-doc', browserName, 1);

  //   // Update share link
  //   await page.getByRole('button', { name: 'Share' }).click();
  //   await updateShareLink(page, 'Connected', 'Reading');
  //   await page.getByRole('button', { name: 'OK' }).click();
  //   await expect(
  //     page.getByText('Document accessible to any connected person'),
  //   ).toBeVisible();

  //   // Create sub page
  //   const { item: subPageItem } = await createRootSubPage(
  //     page,
  //     browserName,
  //     'sub-page',
  //   );
  //   await expect(
  //     page.getByText('Document accessible to any connected person'),
  //   ).toBeVisible();

  //   // Update share link to public and edition
  //   await page.getByRole('button', { name: 'Share' }).click();
  //   await verifyLinkReachIsDisabled(page, 'Private');
  //   await updateShareLink(page, 'Public', 'Edition');
  //   await page.getByRole('button', { name: 'OK' }).click();
  //   await expect(page.getByText('Public document')).toBeVisible();

  //   // Create sub page
  //   await createSubPageFromParent(
  //     page,
  //     browserName,
  //     subPageItem.id,
  //     'sub-page-2',
  //   );
  //   await expect(page.getByText('Public document')).toBeVisible();

  //   // Verify share link and role
  //   await page.getByRole('button', { name: 'Share' }).click();
  //   await verifyLinkReachIsDisabled(page, 'Private');
  //   await verifyLinkReachIsDisabled(page, 'Connected');
  //   await verifyLinkReachIsEnabled(page, 'Public');
  //   await verifyLinkRoleIsDisabled(page, 'Reading');
  //   await verifyLinkRoleIsEnabled(page, 'Edition');
  // });
});
