import { expect, test } from '@playwright/test';

import {
  createDoc,
  goToGridDoc,
  mockedAccesses,
  mockedDocument,
  mockedInvitations,
  verifyDocName,
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

    const docTitle = card.getByRole('textbox', { name: 'doc title input' });
    await expect(docTitle).toBeVisible();

    await expect(card.getByText('Public document')).toBeVisible();

    await expect(card.getByText('Owner ·')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Share' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'download' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Open the document options' }),
    ).toBeVisible();
  });

  test('it updates the title doc', async ({ page, browserName }) => {
    await createDoc(page, 'doc-update', browserName, 1);
    const docTitle = page.getByRole('textbox', { name: 'doc title input' });
    await expect(docTitle).toBeVisible();
    await docTitle.fill('Hello World');
    await docTitle.blur();
    await verifyDocName(page, 'Hello World');
  });

  test('it deletes the doc', async ({ page, browserName }) => {
    const [randomDoc] = await createDoc(page, 'doc-delete', browserName, 1);

    await page.getByLabel('Open the document options').click();
    await page
      .getByRole('button', {
        name: 'Delete document',
      })
      .click();

    await expect(
      page.getByRole('heading', { name: 'Delete a doc' }),
    ).toBeVisible();

    await expect(
      page.getByText(
        `Are you sure you want to delete the document "${randomDoc}"?`,
      ),
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

    await expect(page.getByRole('button', { name: 'download' })).toBeVisible();

    await page.getByLabel('Open the document options').click();

    await expect(
      page.getByRole('button', { name: 'Delete document' }),
    ).toBeDisabled();

    // Click somewhere else to close the options
    await page.click('body', { position: { x: 0, y: 0 } });

    await page.getByRole('button', { name: 'Share' }).click();

    const shareModal = page.getByLabel('Share modal');
    await expect(shareModal).toBeVisible();
    await expect(page.getByText('Share the document')).toBeVisible();

    await expect(page.getByPlaceholder('Type a name or email')).toBeVisible();

    const invitationCard = shareModal.getByLabel('List invitation card');
    await expect(invitationCard).toBeVisible();
    await expect(
      invitationCard.getByText('test@invitation.test').first(),
    ).toBeVisible();
    await expect(invitationCard.getByLabel('doc-role-dropdown')).toBeVisible();

    await invitationCard.getByRole('button', { name: 'more_horiz' }).click();

    await expect(
      page.getByRole('button', {
        name: 'delete',
      }),
    ).toBeEnabled();
    await invitationCard.click();

    const memberCard = shareModal.getByLabel('List members card');
    await expect(memberCard).toBeVisible();
    await expect(
      memberCard.getByText('test@accesses.test').first(),
    ).toBeVisible();
    await expect(memberCard.getByLabel('doc-role-dropdown')).toBeVisible();
    await expect(
      memberCard.getByRole('button', { name: 'more_horiz' }),
    ).toBeVisible();
    await memberCard.getByRole('button', { name: 'more_horiz' }).click();

    await expect(
      page.getByRole('button', {
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

    await expect(page.getByRole('button', { name: 'download' })).toBeVisible();
    await page.getByLabel('Open the document options').click();

    await expect(
      page.getByRole('button', { name: 'Delete document' }),
    ).toBeDisabled();

    // Click somewhere else to close the options
    await page.click('body', { position: { x: 0, y: 0 } });

    await page.getByRole('button', { name: 'Share' }).click();

    const shareModal = page.getByLabel('Share modal');
    await expect(page.getByText('Share the document')).toBeVisible();

    await expect(page.getByPlaceholder('Type a name or email')).toBeHidden();

    const invitationCard = shareModal.getByLabel('List invitation card');
    await expect(
      invitationCard.getByText('test@invitation.test').first(),
    ).toBeVisible();
    await expect(invitationCard.getByLabel('doc-role-text')).toBeVisible();
    await expect(
      invitationCard.getByRole('button', { name: 'more_horiz' }),
    ).toBeHidden();

    const memberCard = shareModal.getByLabel('List members card');
    await expect(memberCard.getByText('test@accesses.test')).toBeVisible();
    await expect(memberCard.getByLabel('doc-role-text')).toBeVisible();
    await expect(
      memberCard.getByRole('button', { name: 'more_horiz' }),
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

    await expect(page.getByRole('button', { name: 'download' })).toBeVisible();
    await page.getByLabel('Open the document options').click();

    await expect(
      page.getByRole('button', { name: 'Delete document' }),
    ).toBeDisabled();

    // Click somewhere else to close the options
    await page.click('body', { position: { x: 0, y: 0 } });

    await page.getByRole('button', { name: 'Share' }).click();

    const shareModal = page.getByLabel('Share modal');
    await expect(page.getByText('Share the document')).toBeVisible();

    await expect(page.getByPlaceholder('Type a name or email')).toBeHidden();

    const invitationCard = shareModal.getByLabel('List invitation card');
    await expect(
      invitationCard.getByText('test@invitation.test').first(),
    ).toBeVisible();
    await expect(invitationCard.getByLabel('doc-role-text')).toBeVisible();
    await expect(
      invitationCard.getByRole('button', { name: 'more_horiz' }),
    ).toBeHidden();

    const memberCard = shareModal.getByLabel('List members card');
    await expect(memberCard.getByText('test@accesses.test')).toBeVisible();
    await expect(memberCard.getByLabel('doc-role-text')).toBeVisible();
    await expect(
      memberCard.getByRole('button', { name: 'more_horiz' }),
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

    await page.getByLabel('Open the document options').click();
    await page.getByRole('button', { name: 'Share' }).click();

    await expect(page.getByLabel('Share modal')).toBeVisible();
    await page.getByRole('button', { name: 'close' }).click();
    await expect(page.getByLabel('Share modal')).toBeHidden();
  });
});
