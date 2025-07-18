import { expect, test } from '@playwright/test';

import { createDoc, getGridRow } from './utils-common';

type SmallDoc = {
  id: string;
  title: string;
};

test.describe('Documents Grid mobile', () => {
  test.use({ viewport: { width: 500, height: 1200 } });

  test('it checks the grid when mobile', async ({ page }) => {
    await page.route('**/documents/**', async (route) => {
      const request = route.request();
      if (request.method().includes('GET') && request.url().includes('page=')) {
        await route.fulfill({
          json: {
            count: 1,
            next: null,
            previous: null,
            results: [
              {
                id: 'b7fd9d9b-0642-4b4f-8617-ce50f69519ed',
                title: 'My mocked document',
                accesses: [
                  {
                    id: '8c1e047a-24e7-4a80-942b-8e9c7ab43e1f',
                    user: {
                      id: '7380f42f-02eb-4ad5-b8f0-037a0e66066d',
                      email: 'test@test.test',
                      full_name: 'John Doe',
                      short_name: 'John',
                    },
                    team: '',
                    role: 'owner',
                    abilities: {
                      destroy: false,
                      update: false,
                      partial_update: false,
                      retrieve: true,
                      set_role_to: [],
                    },
                  },
                ],
                abilities: {
                  attachment_upload: true,
                  destroy: true,
                  link_configuration: true,
                  accesses_manage: true,
                  partial_update: true,
                  retrieve: true,
                  update: true,
                  versions_destroy: true,
                  versions_list: true,
                  versions_retrieve: true,
                },
                link_role: 'reader',
                link_reach: 'public',
                created_at: '2024-10-07T13:02:41.085298Z',
                updated_at: '2024-10-07T13:30:21.829690Z',
                user_roles: ['owner'],
              },
            ],
          },
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');

    const docsGrid = page.getByTestId('docs-grid');
    await expect(docsGrid).toBeVisible();
    await expect(page.getByTestId('grid-loader')).toBeHidden();

    const rows = docsGrid.getByRole('row');
    const row = rows.filter({
      hasText: 'My mocked document',
    });

    await expect(
      row.locator('[aria-describedby="doc-title"]').nth(0),
    ).toHaveText('My mocked document');
  });
});

test.describe('Document grid item options', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('it checks the share modal', async ({ page, browserName }) => {
    const [docTitle] = await createDoc(page, `check share modal`, browserName);

    await page.goto('/');

    await expect(page.getByText(docTitle)).toBeVisible();
    const row = await getGridRow(page, docTitle);
    await row.getByText(`more_horiz`).click();

    await page.getByRole('menuitem', { name: 'Share' }).click();

    await expect(
      page.getByRole('dialog').getByText('Share the document'),
    ).toBeVisible();
  });

  test('it pins a document', async ({ page, browserName }) => {
    const [docTitle] = await createDoc(page, `Favorite doc`, browserName);

    await page.goto('/');

    const row = await getGridRow(page, docTitle);

    // Pin
    await row.getByText(`more_horiz`).click();
    await page.getByText('push_pin').click();

    // Check is pinned
    await expect(row.getByLabel('Pin document icon')).toBeVisible();
    const leftPanelFavorites = page.getByTestId('left-panel-favorites');
    await expect(leftPanelFavorites.getByText(docTitle)).toBeVisible();

    // Unpin
    await row.getByText(`more_horiz`).click();
    await page.getByText('Unpin').click();

    // Check is unpinned
    await expect(row.getByLabel('Pin document icon')).toBeHidden();
    await expect(leftPanelFavorites.getByText(docTitle)).toBeHidden();
  });

  test('it deletes the document', async ({ page, browserName }) => {
    const [docTitle] = await createDoc(page, `delete doc`, browserName);

    await page.goto('/');

    await expect(page.getByText(docTitle)).toBeVisible();
    const row = await getGridRow(page, docTitle);
    await row.getByText(`more_horiz`).click();

    await page.getByRole('menuitem', { name: 'Remove' }).click();

    await expect(
      page.getByRole('heading', { name: 'Delete a doc' }),
    ).toBeVisible();

    await page
      .getByRole('button', {
        name: 'Confirm deletion',
      })
      .click();

    await expect(
      page.getByText('The document has been deleted.'),
    ).toBeVisible();

    await expect(page.getByText(docTitle)).toBeHidden();
  });

  test("it checks if the delete option is disabled if we don't have the destroy capability", async ({
    page,
  }) => {
    await page.route('*/**/api/v1.0/documents/?page=1', async (route) => {
      await route.fulfill({
        json: {
          results: [
            {
              id: 'mocked-document-id',
              content: '',
              title: 'Mocked document',
              accesses: [],
              abilities: {
                destroy: false, // Means not owner
                link_configuration: false,
                versions_destroy: false,
                versions_list: true,
                versions_retrieve: true,
                accesses_manage: false, // Means not admin
                update: false,
                partial_update: false, // Means not editor
                retrieve: true,
              },
              link_reach: 'restricted',
              created_at: '2021-09-01T09:00:00Z',
              user_roles: ['editor'],
              user_role: 'editor',
            },
          ],
        },
      });
    });
    await page.goto('/');

    const button = page.getByTestId(
      `docs-grid-actions-button-mocked-document-id`,
    );
    await expect(button).toBeVisible();
    await button.click();
    const removeButton = page.getByTestId(
      `docs-grid-actions-remove-mocked-document-id`,
    );
    await expect(removeButton).toBeVisible();
    await removeButton.isDisabled();
  });
});

test.describe('Documents filters', () => {
  test('it checks the prebuild left panel filters', async ({ page }) => {
    void page.goto('/');

    // All Docs
    const response = await page.waitForResponse(
      (response) =>
        response.url().endsWith('documents/?page=1') &&
        response.status() === 200,
    );
    const result = await response.json();
    const allCount = result.count as number;
    await expect(page.getByTestId('grid-loader')).toBeHidden();

    const allDocs = page.getByLabel('All docs');
    const myDocs = page.getByLabel('My docs');
    const sharedWithMe = page.getByLabel('Shared with me');

    // Initial state
    await expect(allDocs).toBeVisible();
    await expect(allDocs).toHaveAttribute('aria-selected', 'true');

    await expect(myDocs).toBeVisible();
    await expect(myDocs).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(myDocs).toHaveAttribute('aria-selected', 'false');

    await expect(sharedWithMe).toBeVisible();
    await expect(sharedWithMe).toHaveCSS(
      'background-color',
      'rgba(0, 0, 0, 0)',
    );
    await expect(sharedWithMe).toHaveAttribute('aria-selected', 'false');

    await allDocs.click();

    await page.waitForURL('**/?target=all_docs');

    let url = new URL(page.url());
    let target = url.searchParams.get('target');
    expect(target).toBe('all_docs');

    // My docs
    await myDocs.click();
    url = new URL(page.url());
    target = url.searchParams.get('target');
    expect(target).toBe('my_docs');
    const responseMyDocs = await page.waitForResponse(
      (response) =>
        response.url().endsWith('documents/?page=1&is_creator_me=true') &&
        response.status() === 200,
    );
    const resultMyDocs = await responseMyDocs.json();
    const countMyDocs = resultMyDocs.count as number;
    await expect(page.getByTestId('grid-loader')).toBeHidden();
    expect(countMyDocs).toBeLessThanOrEqual(allCount);

    // Shared with me
    await sharedWithMe.click();
    url = new URL(page.url());
    target = url.searchParams.get('target');
    expect(target).toBe('shared_with_me');
    const responseSharedWithMe = await page.waitForResponse(
      (response) =>
        response.url().includes('documents/?page=1&is_creator_me=false') &&
        response.status() === 200,
    );
    const resultSharedWithMe = await responseSharedWithMe.json();
    const countSharedWithMe = resultSharedWithMe.count as number;
    await expect(page.getByTestId('grid-loader')).toBeHidden();
    expect(countSharedWithMe).toBeLessThanOrEqual(allCount);
    expect(countSharedWithMe + countMyDocs).toEqual(allCount);
  });
});

test.describe('Documents Grid', () => {
  test('checks all the elements are visible', async ({ page }) => {
    void page.goto('/');

    let docs: SmallDoc[] = [];
    const response = await page.waitForResponse(
      (response) =>
        response.url().endsWith('documents/?page=1') &&
        response.status() === 200,
    );
    const result = await response.json();
    docs = result.results as SmallDoc[];

    await expect(page.getByTestId('grid-loader')).toBeHidden();
    await expect(page.locator('h4').getByText('All docs')).toBeVisible();

    const thead = page.getByTestId('docs-grid-header');
    await expect(thead.getByText(/Name/i)).toBeVisible();
    await expect(thead.getByText(/Updated at/i)).toBeVisible();

    await Promise.all(
      docs.map(async (doc) => {
        await expect(
          page.getByTestId(`docs-grid-name-${doc.id}`),
        ).toBeVisible();
      }),
    );
  });

  test('checks the infinite scroll', async ({ page }) => {
    let docs: SmallDoc[] = [];
    const responsePromisePage1 = page.waitForResponse((response) => {
      return (
        response.url().endsWith(`/documents/?page=1`) &&
        response.status() === 200
      );
    });

    const responsePromisePage2 = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/documents/?page=2`) &&
        response.status() === 200,
    );

    await page.goto('/');

    const responsePage1 = await responsePromisePage1;
    expect(responsePage1.ok()).toBeTruthy();
    let result = await responsePage1.json();
    docs = result.results as SmallDoc[];
    await Promise.all(
      docs.map(async (doc) => {
        await expect(
          page.getByTestId(`docs-grid-name-${doc.id}`),
        ).toBeVisible();
      }),
    );

    await page.getByTestId('infinite-scroll-trigger').scrollIntoViewIfNeeded();
    const responsePage2 = await responsePromisePage2;
    result = await responsePage2.json();
    docs = result.results as SmallDoc[];
    await Promise.all(
      docs.map(async (doc) => {
        await expect(
          page.getByTestId(`docs-grid-name-${doc.id}`),
        ).toBeVisible();
      }),
    );
  });
});
