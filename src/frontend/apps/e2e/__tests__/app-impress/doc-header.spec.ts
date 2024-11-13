import { expect, test } from '@playwright/test';

import {
  createDoc,
  goToGridDoc,
  mockedAccesses,
  mockedDocument,
  mockedInvitations,
} from './common';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('Doc Header', () => {
  test('it checks the element are correctly displayed', async ({ page }) => {
    await mockedDocument(page, {
      accesses: [
        {
          id: 'b0df4343-c8bd-4c20-9ff6-fbf94fc94egg',
          role: 'owner',
          user: {
            email: 'super@owner.com',
            full_name: 'Super Owner',
          },
        },
        {
          id: 'b0df4343-c8bd-4c20-9ff6-fbf94fc94egg',
          role: 'admin',
          user: {
            email: 'super@admin.com',
          },
        },
        {
          id: 'b0df4343-c8bd-4c20-9ff6-fbf94fc94egg',
          role: 'owner',
          user: {
            email: 'super2@owner.com',
          },
        },
      ],
      abilities: {
        destroy: true, // Means owner
        link_configuration: true,
        versions_destroy: true,
        versions_list: true,
        versions_retrieve: true,
        accesses_manage: true,
        update: true,
        partial_update: true,
        retrieve: true,
      },
      link_reach: 'public',
      created_at: '2021-09-01T09:00:00Z',
    });

    await goToGridDoc(page);

    const card = page.getByLabel(
      'It is the card information about the document.',
    );
    await expect(card.locator('a').getByText('home')).toBeVisible();
    await expect(card.locator('h2').getByText('Mocked document')).toBeVisible();
    await expect(card.getByText('Public')).toBeVisible();
    await expect(
      card.getByText('Created at 09/01/2021, 11:00 AM'),
    ).toBeVisible();
    await expect(card.getByText('Your role: Owner')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Share' })).toBeVisible();
  });

  test('it updates the title doc', async ({ page, browserName }) => {
    const [randomDoc] = await createDoc(page, 'doc-update', browserName, 1);

    await page.getByRole('heading', { name: randomDoc }).fill(' ');
    await page.getByText('Created at').click();

    await expect(
      page.getByRole('heading', { name: 'Untitled document' }),
    ).toBeVisible();
  });

  test('it updates the title doc from editor heading', async ({ page }) => {
    await page
      .getByRole('button', {
        name: 'New doc',
      })
      .click();

    const docHeader = page.getByLabel(
      'It is the card information about the document.',
    );

    await expect(
      docHeader.getByRole('heading', { name: 'Untitled document', level: 2 }),
    ).toBeVisible();

    const editor = page.locator('.ProseMirror');

    await editor.locator('h1').click();
    await page.keyboard.type('Hello World', { delay: 100 });

    await expect(
      docHeader.getByRole('heading', { name: 'Hello World', level: 2 }),
    ).toBeVisible();

    await expect(
      page.getByText('Document title updated successfully'),
    ).toBeVisible();

    await docHeader
      .getByRole('heading', { name: 'Hello World', level: 2 })
      .fill('Top World');

    await editor.locator('h1').fill('Super World');

    await expect(
      docHeader.getByRole('heading', { name: 'Top World', level: 2 }),
    ).toBeVisible();

    await editor.locator('h1').fill('');

    // eslint-disable-next-line playwright/no-wait-for-timeout
    await page.waitForTimeout(500);

    await docHeader
      .getByRole('heading', { name: 'Top World', level: 2 })
      .fill(' ');

    await page.getByText('Created at').click();

    await expect(
      docHeader.getByRole('heading', { name: 'Untitled  document', level: 2 }),
    ).toBeVisible();
  });

  test('it deletes the doc', async ({ page, browserName }) => {
    const [randomDoc] = await createDoc(page, 'doc-delete', browserName, 1);
    await expect(page.locator('h2').getByText(randomDoc)).toBeVisible();

    await page.getByLabel('Open the document options').click();
    await page
      .getByRole('button', {
        name: 'Delete document',
      })
      .click();

    await expect(
      page.locator('h2').getByText(`Deleting the document "${randomDoc}"`),
    ).toBeVisible();

    await page
      .getByRole('button', {
        name: 'Confirm deletion',
      })
      .click();

    await expect(
      page.getByText('The document has been deleted.'),
    ).toBeVisible();

    await expect(page.getByRole('button', { name: 'New do' })).toBeVisible();

    const row = page
      .getByLabel('Datagrid of the documents page 1')
      .getByRole('table')
      .getByRole('row')
      .filter({
        hasText: randomDoc,
      });

    expect(await row.count()).toBe(0);
  });

  test('it checks the options available if administrator', async ({ page }) => {
    await mockedDocument(page, {
      abilities: {
        accesses_manage: true, // Means admin
        accesses_view: true,
        destroy: false, // Means not owner
        link_configuration: true,
        versions_destroy: true,
        versions_list: true,
        versions_retrieve: true,
        update: true,
        partial_update: true,
        retrieve: true,
      },
    });

    await mockedInvitations(page);
    await mockedAccesses(page);

    await goToGridDoc(page);

    await expect(
      page.locator('h2').getByText('Mocked document'),
    ).toHaveAttribute('contenteditable');

    await page.getByLabel('Open the document options').click();

    await expect(page.getByRole('button', { name: 'Export' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Delete document' }),
    ).toBeHidden();

    // Click somewhere else to close the options
    await page.click('body', { position: { x: 0, y: 0 } });

    await page.getByRole('button', { name: 'Share' }).click();

    const shareModal = page.getByLabel('Share modal');

    await expect(
      shareModal.getByRole('combobox', {
        name: 'Visibility',
      }),
    ).not.toHaveAttribute('disabled');
    await expect(shareModal.getByText('Search by email')).toBeVisible();

    const invitationCard = shareModal.getByLabel('List invitation card');
    await expect(
      invitationCard.getByText('test@invitation.test'),
    ).toBeVisible();
    await expect(
      invitationCard.getByRole('combobox', { name: 'Role' }),
    ).toBeEnabled();
    await expect(
      invitationCard.getByRole('button', {
        name: 'delete',
      }),
    ).toBeEnabled();

    const memberCard = shareModal.getByLabel('List members card');
    await expect(memberCard.getByText('test@accesses.test')).toBeVisible();
    await expect(
      memberCard.getByRole('combobox', { name: 'Role' }),
    ).toBeEnabled();
    await expect(
      memberCard.getByRole('button', {
        name: 'delete',
      }),
    ).toBeEnabled();
  });

  test('it checks the options available if editor', async ({ page }) => {
    await mockedDocument(page, {
      abilities: {
        accesses_manage: false, // Means not admin
        accesses_view: true,
        destroy: false, // Means not owner
        link_configuration: false,
        versions_destroy: true,
        versions_list: true,
        versions_retrieve: true,
        update: true,
        partial_update: true, // Means editor
        retrieve: true,
      },
    });

    await mockedInvitations(page, {
      abilities: {
        destroy: false,
        update: false,
        partial_update: false,
        retrieve: true,
      },
    });
    await mockedAccesses(page);

    await goToGridDoc(page);

    await expect(
      page.locator('h2').getByText('Mocked document'),
    ).toHaveAttribute('contenteditable');

    await page.getByLabel('Open the document options').click();

    await expect(page.getByRole('button', { name: 'Export' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Delete document' }),
    ).toBeHidden();

    // Click somewhere else to close the options
    await page.click('body', { position: { x: 0, y: 0 } });

    await page.getByRole('button', { name: 'Share' }).click();

    const shareModal = page.getByLabel('Share modal');

    await expect(
      shareModal.getByRole('combobox', {
        name: 'Visibility',
      }),
    ).toHaveAttribute('disabled');
    await expect(shareModal.getByText('Search by email')).toBeHidden();

    const invitationCard = shareModal.getByLabel('List invitation card');
    await expect(
      invitationCard.getByText('test@invitation.test'),
    ).toBeVisible();
    await expect(
      invitationCard.getByRole('combobox', { name: 'Role' }),
    ).toHaveAttribute('disabled');
    await expect(
      invitationCard.getByRole('button', {
        name: 'delete',
      }),
    ).toBeHidden();

    const memberCard = shareModal.getByLabel('List members card');
    await expect(memberCard.getByText('test@accesses.test')).toBeVisible();
    await expect(
      memberCard.getByRole('combobox', { name: 'Role' }),
    ).toHaveAttribute('disabled');
    await expect(
      memberCard.getByRole('button', {
        name: 'delete',
      }),
    ).toBeHidden();
  });

  test('it checks the options available if reader', async ({ page }) => {
    await mockedDocument(page, {
      abilities: {
        accesses_manage: false, // Means not admin
        accesses_view: true,
        destroy: false, // Means not owner
        link_configuration: false,
        versions_destroy: false,
        versions_list: true,
        versions_retrieve: true,
        update: false,
        partial_update: false, // Means not editor
        retrieve: true,
      },
    });

    await mockedInvitations(page, {
      abilities: {
        destroy: false,
        update: false,
        partial_update: false,
        retrieve: true,
      },
    });
    await mockedAccesses(page);

    await goToGridDoc(page);

    await expect(
      page.locator('h2').getByText('Mocked document'),
    ).not.toHaveAttribute('contenteditable');

    await page.getByLabel('Open the document options').click();

    await expect(page.getByRole('button', { name: 'Export' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Delete document' }),
    ).toBeHidden();

    // Click somewhere else to close the options
    await page.click('body', { position: { x: 0, y: 0 } });

    await page.getByRole('button', { name: 'Share' }).click();

    const shareModal = page.getByLabel('Share modal');

    await expect(
      shareModal.getByRole('combobox', {
        name: 'Visibility',
      }),
    ).toHaveAttribute('disabled');
    await expect(shareModal.getByText('Search by email')).toBeHidden();

    const invitationCard = shareModal.getByLabel('List invitation card');
    await expect(
      invitationCard.getByText('test@invitation.test'),
    ).toBeVisible();
    await expect(
      invitationCard.getByRole('combobox', { name: 'Role' }),
    ).toHaveAttribute('disabled');
    await expect(
      invitationCard.getByRole('button', {
        name: 'delete',
      }),
    ).toBeHidden();

    const memberCard = shareModal.getByLabel('List members card');
    await expect(memberCard.getByText('test@accesses.test')).toBeVisible();
    await expect(
      memberCard.getByRole('combobox', { name: 'Role' }),
    ).toHaveAttribute('disabled');
    await expect(
      memberCard.getByRole('button', {
        name: 'delete',
      }),
    ).toBeHidden();
  });

  test('It checks the copy as Markdown button', async ({
    page,
    browserName,
  }) => {
    // eslint-disable-next-line playwright/no-skipped-test
    test.skip(
      browserName === 'webkit',
      'navigator.clipboard is not working with webkit and playwright',
    );

    // create page and navigate to it
    await page
      .getByRole('button', {
        name: 'New doc',
      })
      .click();

    // Add dummy content to the doc
    const editor = page.locator('.ProseMirror');
    const docFirstBlock = editor.locator('.bn-block-content').first();
    await docFirstBlock.click();
    await page.keyboard.type('# Hello World', { delay: 100 });
    const docFirstBlockContent = docFirstBlock.locator('h1');
    await expect(docFirstBlockContent).toHaveText('Hello World');

    // Copy content to clipboard
    await page.getByLabel('Open the document options').click();
    await page.getByRole('button', { name: 'Copy as Markdown' }).click();
    await expect(page.getByText('Copied to clipboard')).toBeVisible();

    // Test that clipboard is in Markdown format
    const handle = await page.evaluateHandle(() =>
      navigator.clipboard.readText(),
    );
    const clipboardContent = await handle.jsonValue();
    expect(clipboardContent.trim()).toBe('# Hello World');
  });

  test('It checks the copy as HTML button', async ({ page, browserName }) => {
    // eslint-disable-next-line playwright/no-skipped-test
    test.skip(
      browserName === 'webkit',
      'navigator.clipboard is not working with webkit and playwright',
    );

    // create page and navigate to it
    await page
      .getByRole('button', {
        name: 'New doc',
      })
      .click();

    // Add dummy content to the doc
    const editor = page.locator('.ProseMirror');
    const docFirstBlock = editor.locator('.bn-block-content').first();
    await docFirstBlock.click();
    await page.keyboard.type('# Hello World', { delay: 100 });
    const docFirstBlockContent = docFirstBlock.locator('h1');
    await expect(docFirstBlockContent).toHaveText('Hello World');

    // Copy content to clipboard
    await page.getByLabel('Open the document options').click();
    await page.getByRole('button', { name: 'Copy as HTML' }).click();
    await expect(page.getByText('Copied to clipboard')).toBeVisible();

    // Test that clipboard is in HTML format
    const handle = await page.evaluateHandle(() =>
      navigator.clipboard.readText(),
    );
    const clipboardContent = await handle.jsonValue();
    expect(clipboardContent.trim()).toBe(`<h1>Hello World</h1><p></p>`);
  });
});

test.describe('Documents Header mobile', () => {
  test.use({ viewport: { width: 500, height: 1200 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('it checks the close button on Share modal', async ({ page }) => {
    await mockedDocument(page, {
      abilities: {
        destroy: true, // Means owner
        link_configuration: true,
        versions_destroy: true,
        versions_list: true,
        versions_retrieve: true,
        accesses_manage: true,
        update: true,
        partial_update: true,
        retrieve: true,
      },
    });

    await goToGridDoc(page);

    await page.getByRole('button', { name: 'Share' }).click();

    await expect(page.getByLabel('Share modal')).toBeVisible();
    await page.getByRole('button', { name: 'close' }).click();
    await expect(page.getByLabel('Share modal')).toBeHidden();
  });
});
