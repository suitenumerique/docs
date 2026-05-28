import { expect, test } from '@playwright/test';

import {
  createDoc,
  goToGridDoc,
  mockedDocument,
  saveContent,
  verifyDocName,
} from './utils-common';
import { openSuggestionMenu, writeInEditor } from './utils-editor';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('Doc Version', () => {
  test('it displays the doc versions', async ({ page, browserName }) => {
    const [randomDoc] = await createDoc(page, 'doc-version', browserName, 1);

    // Initially, there is no version
    await page.getByLabel('Open the document options').click();
    await page.getByRole('menuitem', { name: 'Version history' }).click();
    await expect(page.getByText('History', { exact: true })).toBeVisible();

    const modal = page.getByRole('dialog', { name: 'Version history' });
    const panel = modal.getByLabel('Version list');
    await expect(panel).toBeVisible();
    await expect(modal.getByText('No versions')).toBeVisible();

    await modal.getByRole('button', { name: 'close' }).click();

    await writeInEditor({ page, text: 'Hello World' });

    await saveContent(page, randomDoc);

    await expect(page.getByText('Hello World')).toBeVisible();

    // Write more
    await writeInEditor({ page, text: 'It will create a version' });

    const { suggestionMenu } = await openSuggestionMenu({ page });
    await suggestionMenu.getByText('Add a callout block').click();

    const calloutBlock = page
      .locator('div[data-content-type="callout"]')
      .first();

    await expect(calloutBlock).toBeVisible();

    await saveContent(page, randomDoc);

    await expect(page.getByText('Hello World')).toBeHidden();
    await expect(page.getByText('It will create a version')).toBeVisible();

    await expect(calloutBlock).toBeVisible();

    // Write more
    await writeInEditor({ page, text: 'It will create a second version' });

    await saveContent(page, randomDoc);

    await expect(
      page.getByText('It will create a second version'),
    ).toBeVisible();

    await page.getByLabel('Open the document options').click();
    await page.getByRole('menuitem', { name: 'Version history' }).click();

    await expect(panel).toBeVisible();
    await expect(page.getByText('History', { exact: true })).toBeVisible();
    await expect(page.getByRole('status')).toBeHidden();
    const items = panel.locator('.version-item');
    await expect(items).toHaveCount(2);
    await items.nth(1).click();

    await expect(modal.getByText('Hello World')).toBeVisible();
    await expect(modal.getByText('It will create a version')).toBeHidden();
    await expect(
      modal.locator('div[data-content-type="callout"]').first(),
    ).toBeHidden();

    await items.nth(0).click();

    await expect(modal.getByText('Hello World')).toBeVisible();
    await expect(modal.getByText('It will create a version')).toBeVisible();
    await expect(
      modal.locator('div[data-content-type="callout"]').first(),
    ).toBeVisible();
    await expect(
      modal.getByText('It will create a second version'),
    ).toBeHidden();

    await items.nth(1).click();

    await expect(modal.getByText('Hello World')).toBeVisible();
    await expect(modal.getByText('It will create a version')).toBeHidden();
    await expect(
      modal.locator('div[data-content-type="callout"]').first(),
    ).toBeHidden();
  });

  test('it does not display the doc versions if not allowed', async ({
    page,
  }) => {
    await mockedDocument(page, {
      abilities: {
        versions_list: false,
        partial_update: true,
      },
    });

    await goToGridDoc(page);

    await verifyDocName(page, 'Mocked document');

    await page.getByLabel('Open the document options').click();
    await expect(
      page.getByRole('menuitem', { name: 'Version history' }),
    ).toBeHidden();
  });

  test('it restores the doc version', async ({ page, browserName }) => {
    const [randomDoc] = await createDoc(page, 'doc-version', browserName, 1);
    await verifyDocName(page, randomDoc);

    const editor = await writeInEditor({ page, text: 'Hello' });

    // Add a comment
    await editor.getByText('Hello').selectText();
    await page.getByRole('button', { name: 'Add comment' }).click();

    const thread = page.locator('.bn-thread');
    await thread.getByRole('paragraph').first().fill('This is a comment');
    await thread.locator('[data-test="save"]').click();
    await expect(thread).toBeHidden();

    await saveContent(page, randomDoc);

    await expect(editor.getByText('Hello')).toBeVisible();
    await page.locator('.bn-block-outer').last().click();
    await page.keyboard.press('Enter');
    await page.locator('.bn-block-outer').last().fill('World');

    await saveContent(page, randomDoc);

    await expect(page.getByText('World')).toBeVisible();

    await editor.getByText('Hello').click();
    await thread.getByText('This is a comment').first().hover();
    await thread.locator('[data-test="resolve"]').click();
    await expect(thread).toBeHidden();

    await page.getByLabel('Open the document options').click();
    await page.getByRole('menuitem', { name: 'Version history' }).click();

    const modal = page.getByRole('dialog', { name: 'Version history' });
    const panel = modal.getByLabel('Version list');
    await expect(panel).toBeVisible();

    await expect(page.getByText('History', { exact: true })).toBeVisible();
    await panel.locator('.version-item').first().click();

    await expect(modal.getByText('World')).toBeHidden();

    await page.getByRole('button', { name: 'Restore', exact: true }).click();
    await expect(
      page.getByText(
        "The current document will be replaced, but you'll still find it in the version history.",
      ),
    ).toBeVisible();

    await page.getByLabel('Restore', { exact: true }).click();

    const mainEditor = page.getByLabel('Document editor');

    await expect(mainEditor.getByText('Hello')).toBeVisible();
    await expect(mainEditor.getByText('World')).toBeHidden();

    // The old comment is not restored
    await expect(mainEditor.getByText('Hello')).toHaveCSS(
      'background-color',
      'rgba(0, 0, 0, 0)',
    );

    // We can add a new comment
    await mainEditor.getByText('Hello').selectText();
    await page.getByRole('button', { name: 'Add comment' }).click();

    await thread.getByRole('paragraph').first().fill('This is a comment');
    await thread.locator('[data-test="save"]').click();
    await expect(mainEditor.getByText('Hello')).toHaveClass('bn-thread-mark');
  });
});
