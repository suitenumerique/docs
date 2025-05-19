import { expect, test } from '@playwright/test';

import { createDoc } from './common';
import {
  addMemberToDoc,
  searchUserToInviteToDoc,
  updateShareLink,
  verifyLinkReachIsDisabled,
  verifyLinkReachIsEnabled,
  verifyLinkRoleIsDisabled,
  verifyLinkRoleIsEnabled,
  verifyMemberAddedToDoc,
} from './share-utils';
import { createRootSubPage, createSubPageFromParent } from './sub-pages-utils';

test.describe('Inherited share accesses', () => {
  test('Vérifie l’héritage des accès', async ({ page, browserName }) => {
    await page.goto('/');
    const [titleParent] = await createDoc(page, 'root-doc', browserName, 1);
    const docTree = page.getByTestId('doc-tree');

    const addButton = page.getByRole('button', { name: 'New page' });
    // Wait for and intercept the POST request to create a new page
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/documents/') &&
        response.url().includes('/children/') &&
        response.request().method() === 'POST',
    );
    await addButton.click();

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
    await expect(page.getByText('Inherited share')).toBeVisible();
    await expect(page.getByRole('link', { name: titleParent })).toBeVisible();
    await page.getByRole('button', { name: 'See access' }).click();
    await expect(page.getByText('Access inherited from the')).toBeVisible();
    const user = page.getByTestId(
      `doc-share-member-row-user@${browserName}.e2e`,
    );
    await expect(user).toBeVisible();
    await expect(user.getByText('E2E Chromium')).toBeVisible();
    await expect(user.getByText('Owner')).toBeVisible();
  });

  test('Vérifie le message si il y a un accès hérité', async ({
    page,
    browserName,
  }) => {
    await page.goto('/');
    await createDoc(page, 'root-doc', browserName, 1);

    // Search user to add
    let users = await searchUserToInviteToDoc(page);
    let userToAdd = users[0];

    // Add user as Administrator in root doc
    await addMemberToDoc(page, 'Administrator', [userToAdd]);
    await verifyMemberAddedToDoc(page, userToAdd, 'Administrator');
    await page.getByRole('button', { name: 'OK' }).click();

    // Create sub page
    const { name: subPageName, item: subPageJson } = await createRootSubPage(
      page,
      browserName,
      'sub-page',
    );

    // Add user as Editor in sub page
    users = await searchUserToInviteToDoc(page);
    userToAdd = users[0];
    await addMemberToDoc(page, 'Editor', [userToAdd]);
    const userRow = await verifyMemberAddedToDoc(page, userToAdd, 'Editor');
    await userRow.getByRole('button', { name: 'doc-role-dropdown' }).click();
    await page.getByText('This user has access').click();
    await userRow.click();
    await page.getByRole('button', { name: 'OK' }).click();

    // Add new sub page to sub page
    await createSubPageFromParent(
      page,
      browserName,
      subPageJson.id,
      'sub-page-2',
    );

    // // Check sub page inherited share
    await page.getByRole('button', { name: 'Share' }).click();
    await expect(page.getByText('Inherited share')).toBeVisible();
    await expect(page.getByRole('link', { name: subPageName })).toBeVisible();
    await page.getByRole('button', { name: 'See access' }).click();
    await expect(page.getByText('Access inherited from the')).toBeVisible();
    const user = page.getByTestId(`doc-share-member-row-${userToAdd.email}`);
    await expect(user).toBeVisible();
    await expect(user.getByText('Administrator')).toBeVisible();
  });
});

test.describe('Inherited share link', () => {
  test('Vérifie si le lien est bien hérité', async ({ page, browserName }) => {
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
    await expect(page.getByText('Inherited share')).toBeVisible();
    // await verifyShareLink(page, 'Connected', 'Reading');
  });

  test('Vérification du message de warning lorsque les règles de partage diffèrent', async ({
    page,
    browserName,
  }) => {
    await page.goto('/');
    // Create root doc
    await createDoc(page, 'root-doc', browserName, 1);

    // Update share link
    await page.getByRole('button', { name: 'Share' }).click();
    await updateShareLink(page, 'Connected', 'Reading');
    await page.getByRole('button', { name: 'OK' }).click();

    // Create sub page
    await createRootSubPage(page, browserName, 'sub-page');
    await page.getByRole('button', { name: 'Share' }).click();

    // Update share link to public and edition
    await updateShareLink(page, 'Public', 'Edition');
    await expect(page.getByText('Sharing rules differ from the')).toBeVisible();
    const restoreButton = page.getByRole('button', { name: 'Restore' });
    await expect(restoreButton).toBeVisible();
    await restoreButton.click();
    await expect(
      page.getByText('The document visibility has been updated').first(),
    ).toBeVisible();
    await expect(page.getByText('Sharing rules differ from the')).toBeHidden();
  });

  test('Vérification des possibilités de liens hérités', async ({
    page,
    browserName,
  }) => {
    await page.goto('/');
    // Create root doc
    await createDoc(page, 'root-doc', browserName, 1);

    // Update share link
    await page.getByRole('button', { name: 'Share' }).click();
    await updateShareLink(page, 'Connected', 'Reading');
    await page.getByRole('button', { name: 'OK' }).click();
    await expect(
      page.getByText('Document accessible to any connected person'),
    ).toBeVisible();

    // Create sub page
    const { item: subPageItem } = await createRootSubPage(
      page,
      browserName,
      'sub-page',
    );
    await expect(
      page.getByText('Document accessible to any connected person'),
    ).toBeVisible();

    // Update share link to public and edition
    await page.getByRole('button', { name: 'Share' }).click();
    await verifyLinkReachIsDisabled(page, 'Private');
    await updateShareLink(page, 'Public', 'Edition');
    await page.getByRole('button', { name: 'OK' }).click();
    await expect(page.getByText('Public document')).toBeVisible();

    // Create sub page
    await createSubPageFromParent(
      page,
      browserName,
      subPageItem.id,
      'sub-page-2',
    );
    await expect(page.getByText('Public document')).toBeVisible();

    // Verify share link and role
    await page.getByRole('button', { name: 'Share' }).click();
    await verifyLinkReachIsDisabled(page, 'Private');
    await verifyLinkReachIsDisabled(page, 'Connected');
    await verifyLinkReachIsEnabled(page, 'Public');
    await verifyLinkRoleIsDisabled(page, 'Reading');
    await verifyLinkRoleIsEnabled(page, 'Edition');
  });
});
