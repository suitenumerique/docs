import { expect, test } from '@playwright/test';

import { waitForElementCount } from '../helpers';

import { addNewMember, createDoc, goToGridDoc, verifyDocName } from './common';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('Document list members', () => {
  test('it checks a big list of members', async ({ page }) => {
    await page.route(
      /.*\/documents\/.*\/accesses\/\?page=.*/,
      async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const pageId = url.searchParams.get('page');
        const accesses = {
          count: 100,
          next: 'http://anything/?page=2',
          previous: null,
          results: Array.from({ length: 20 }, (_, i) => ({
            id: `2ff1ec07-86c1-4534-a643-f41824a6c53a-${pageId}-${i}`,
            user: {
              id: `fc092149-cafa-4ffa-a29d-e4b18af751-${pageId}-${i}`,
              email: `impress@impress.world-page-${pageId}-${i}`,
              full_name: `Impress World Page ${pageId}-${i}`,
            },
            team: '',
            role: 'editor',
            abilities: {
              destroy: false,
              partial_update: true,
              set_role_to: [],
            },
          })),
        };

        if (request.method().includes('GET')) {
          await route.fulfill({
            json: accesses,
          });
        } else {
          await route.continue();
        }
      },
    );

    await goToGridDoc(page);

    await page.getByRole('button', { name: 'Share' }).click();

    const list = page.getByLabel('List members card').locator('ul');
    await expect(list.locator('li')).toHaveCount(20);
    await list.getByText(`impress@impress.world-page-${1}-18`).hover();
    const loadMoreButton = page
      .getByLabel('List members card')
      .getByRole('button', { name: 'arrow_downward Load more' });
    await loadMoreButton.scrollIntoViewIfNeeded();
    await waitForElementCount(list.locator('li'), 21, 10000);

    expect(await list.locator('li').count()).toBeGreaterThan(20);
    await expect(list.getByText(`Impress World Page 1-16`)).toBeVisible();
    await expect(
      list.getByText(`impress@impress.world-page-1-16`),
    ).toBeVisible();
    await expect(list.getByText(`Impress World Page 2-15`)).toBeVisible();
    await expect(
      list.getByText(`impress@impress.world-page-2-15`),
    ).toBeVisible();
  });

  test('it checks a big list of invitations', async ({ page }) => {
    await page.route(
      /.*\/documents\/.*\/invitations\/\?page=.*/,
      async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const pageId = url.searchParams.get('page');
        const accesses = {
          count: 100,
          next: 'http://anything/?page=2',
          previous: null,
          results: Array.from({ length: 20 }, (_, i) => ({
            id: `2ff1ec07-86c1-4534-a643-f41824a6c53a-${pageId}-${i}`,
            email: `impress@impress.world-page-${pageId}-${i}`,
            team: '',
            role: 'editor',
            abilities: {
              destroy: true,
              update: true,
              partial_update: true,
              retrieve: true,
            },
          })),
        };

        if (request.method().includes('GET')) {
          await route.fulfill({
            json: accesses,
          });
        } else {
          await route.continue();
        }
      },
    );

    await goToGridDoc(page);

    await page.getByRole('button', { name: 'Share' }).click();

    const list = page.getByLabel('List invitation card').locator('ul');

    await expect(list.locator('li')).toHaveCount(20);
    await list.getByText(`impress@impress.world-page-${1}-18`).hover();
    const loadMoreButton = page
      .getByLabel('List invitation card')
      .getByRole('button', { name: 'arrow_downward Load more' });
    await loadMoreButton.scrollIntoViewIfNeeded();

    await waitForElementCount(list.locator('li'), 21, 10000);

    expect(await list.locator('li').count()).toBeGreaterThan(20);
    await expect(
      list.getByText(`impress@impress.world-page-1-16`),
    ).toBeVisible();
    await expect(
      list.getByText(`impress@impress.world-page-2-15`),
    ).toBeVisible();
  });

  test('it checks the role rules', async ({ page, browserName }) => {
    const [docTitle] = await createDoc(page, 'Doc role rules', browserName, 1);

    await verifyDocName(page, docTitle);

    await page.getByRole('button', { name: 'Share' }).click();

    const list = page.getByLabel('List members card').locator('ul');

    await expect(list.getByText(`user@${browserName}.e2e`)).toBeVisible();

    const soleOwner = list.getByText(
      `You are the sole owner of this group, make another member the group owner before you can change your own role or be removed from your document.`,
    );

    await expect(soleOwner).toBeVisible();

    const username = await addNewMember(page, 0, 'Owner');

    await expect(list.getByText(username)).toBeVisible();

    await expect(soleOwner).toBeHidden();

    const otherOwner = list.getByText(
      `You cannot update the role or remove other owner.`,
    );

    await expect(otherOwner).toBeVisible();

    const SelectRoleCurrentUser = list
      .locator('li')
      .filter({
        hasText: `user@${browserName}.e2e`,
      })
      .getByRole('combobox', { name: 'Role' });

    await SelectRoleCurrentUser.click();
    await page.getByRole('option', { name: 'Administrator' }).click();
    await expect(page.getByText('The role has been updated')).toBeVisible();

    const shareModal = page.getByLabel('Share modal');

    // Admin still have the right to share
    await expect(
      shareModal.getByRole('combobox', {
        name: 'Visibility',
      }),
    ).not.toHaveAttribute('disabled');

    await SelectRoleCurrentUser.click();
    await page.getByRole('option', { name: 'Reader' }).click();
    await expect(page.getByText('The role has been updated')).toBeVisible();

    // Reader does not have the right to share
    await expect(
      shareModal.getByRole('combobox', {
        name: 'Visibility',
      }),
    ).toHaveAttribute('disabled');
  });

  test('it checks the delete members', async ({ page, browserName }) => {
    const [docTitle] = await createDoc(page, 'Doc role rules', browserName, 1);

    await verifyDocName(page, docTitle);

    await page.getByRole('button', { name: 'Share' }).click();

    const list = page.getByLabel('List members card').locator('ul');

    const nameMyself = `user@${browserName}.e2e`;
    await expect(list.getByText(nameMyself)).toBeVisible();

    const userOwner = await addNewMember(page, 0, 'Owner');
    await expect(list.getByText(userOwner)).toBeVisible();

    const userReader = await addNewMember(page, 0, 'Reader');
    await expect(list.getByText(userReader)).toBeVisible();

    await list
      .locator('li')
      .filter({
        hasText: userReader,
      })
      .getByText('delete')
      .click();

    await expect(list.getByText(userReader)).toBeHidden();

    await list
      .locator('li')
      .filter({
        hasText: nameMyself,
      })
      .getByText('delete')
      .click();

    await expect(list.getByText(nameMyself)).toBeHidden();

    await expect(
      page.getByText('The member has been removed from the document').first(),
    ).toBeVisible();

    await expect(
      page.getByRole('heading', { name: 'Share', level: 3 }),
    ).toBeHidden();
  });
});
