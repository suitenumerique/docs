import { expect, test } from '@playwright/test';

import { addNewMember, createDoc, goToGridDoc, verifyDocName } from './common';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('Document list members', () => {
  test('it checks a big list of members', async ({ page }) => {
    const docTitle = await goToGridDoc(page);
    await verifyDocName(page, docTitle);

    // Get the current URL and extract the last part
    const currentUrl = page.url();

    const currentDocId = (() => {
      // Remove trailing slash if present
      const cleanUrl = currentUrl.endsWith('/')
        ? currentUrl.slice(0, -1)
        : currentUrl;

      // Split by '/' and get the last part
      return cleanUrl.split('/').pop() || '';
    })();

    await page.route('**/documents/**/accesses/', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const pageId = url.searchParams.get('page') ?? '1';

      const accesses = Array.from({ length: 20 }, (_, i) => ({
        id: `2ff1ec07-86c1-4534-a643-f41824a6c53a-${pageId}-${i}`,
        document: {
          id: currentDocId,
          name: `Doc ${pageId}-${i}`,
          path: `0000.${pageId}-${i}`,
        },
        user: {
          id: `fc092149-cafa-4ffa-a29d-e4b18af751-${pageId}-${i}`,
          email: `impress@impress.world-page-${pageId}-${i}`,
          full_name: `Impress World Page ${pageId}-${i}`,
        },
        team: '',
        role: 'editor',
        max_ancestors_role: null,
        max_role: 'editor',
        abilities: {
          destroy: false,
          partial_update: true,
          set_role_to: ['administrator', 'editor'],
        },
      }));

      if (request.method().includes('GET')) {
        await route.fulfill({
          json: accesses,
        });
      } else {
        await route.continue();
      }
    });

    await page.getByRole('button', { name: 'Share' }).click();

    const prefix = 'doc-share-member-row';
    const elements = page.locator(`[data-testid^="${prefix}"]`);
    const loadMore = page.getByTestId('load-more-members');

    await expect(elements).toHaveCount(20);

    await expect(loadMore).toBeHidden();
  });

  test('it checks a big list of invitations', async ({ page }) => {
    await page.route(
      /.*\/documents\/.*\/invitations\/\?page=.*/,
      async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const pageId = url.searchParams.get('page') ?? '1';
        const accesses = {
          count: 40,
          next: +pageId < 2 ? 'http://anything/?page=2' : null,
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

    const docTitle = await goToGridDoc(page);
    await verifyDocName(page, docTitle);
    await page.getByRole('button', { name: 'Share' }).click();

    const prefix = 'doc-share-invitation';
    const elements = page.locator(`[data-testid^="${prefix}"]`);
    const loadMore = page.getByTestId('load-more-invitations');

    await expect(elements).toHaveCount(20);
    await expect(
      page.getByText(`impress@impress.world-page-1-16`).first(),
    ).toBeVisible();

    await loadMore.click();
    await expect(elements).toHaveCount(40);
    await expect(
      page.getByText(`impress@impress.world-page-2-16`).first(),
    ).toBeVisible();

    await expect(loadMore).toBeHidden();
  });

  test('it checks the role rules', async ({ page, browserName }) => {
    const [docTitle] = await createDoc(page, 'Doc role rules', browserName, 1);

    await verifyDocName(page, docTitle);

    await page.getByRole('button', { name: 'Share' }).click();
    const list = page.getByTestId('doc-share-quick-search');
    await expect(list).toBeVisible();
    const currentUser = list.getByTestId(
      `doc-share-member-row-user@${browserName}.test`,
    );
    const currentUserRole = currentUser.getByLabel('doc-role-dropdown');
    await expect(currentUser).toBeVisible();
    await expect(currentUserRole).toBeVisible();
    await currentUserRole.click();
    const soloOwner = page.getByText(
      `You are the sole owner of this group, make another member the group owner before you can change your own role or be removed from your document.`,
    );
    await expect(soloOwner).toBeVisible();
    await list.click();
    const newUserEmail = await addNewMember(page, 0, 'Owner');
    const newUser = list.getByTestId(`doc-share-member-row-${newUserEmail}`);
    const newUserRoles = newUser.getByLabel('doc-role-dropdown');

    await expect(newUser).toBeVisible();

    await currentUserRole.click();
    await expect(soloOwner).toBeHidden();
    await list.click();

    await newUserRoles.click();
    await list.click();

    await currentUserRole.click();
    await page.getByLabel('Administrator').click();
    await list.click();
    await expect(currentUserRole).toBeVisible();

    await currentUserRole.click();
    await page.getByLabel('Reader').click();
    await list.click();
    await expect(currentUserRole).toBeHidden();
  });

  test('it checks the delete members', async ({ page, browserName }) => {
    const [docTitle] = await createDoc(page, 'Doc role rules', browserName, 1);

    await verifyDocName(page, docTitle);

    await page.getByRole('button', { name: 'Share' }).click();

    const list = page.getByTestId('doc-share-quick-search');

    const emailMyself = `user@${browserName}.test`;
    const mySelf = list.getByTestId(`doc-share-member-row-${emailMyself}`);
    const mySelfRole = mySelf.getByRole('button', {
      name: 'doc-role-dropdown',
    });

    const userOwnerEmail = await addNewMember(page, 0, 'Owner');
    const userOwner = list.getByTestId(
      `doc-share-member-row-${userOwnerEmail}`,
    );

    await page.getByRole('button', { name: 'close' }).first().click();
    await page.getByRole('button', { name: 'Share' }).first().click();

    const userReaderEmail = await addNewMember(page, 0, 'Reader');

    const userReader = list.getByTestId(
      `doc-share-member-row-${userReaderEmail}`,
    );
    const userReaderRole = userReader.getByRole('button', {
      name: 'doc-role-dropdown',
    });

    await expect(mySelf).toBeVisible();
    await expect(userOwner).toBeVisible();
    await expect(userReader).toBeVisible();

    await userReaderRole.click();
    await page.getByRole('menuitem', { name: 'Remove access' }).click();
    await expect(userReader).toBeHidden();

    await mySelfRole.click();
    await page.getByRole('menuitem', { name: 'Remove access' }).click();
    await expect(
      page.getByText('Insufficient access rights to view the document.'),
    ).toBeVisible();
  });
});
