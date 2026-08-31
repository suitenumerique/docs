import { expect, test } from '@playwright/test';

import {
  createDoc,
  goToGridDoc,
  mockedDocument,
  reopenDoc,
  verifyDocName,
} from './utils-common';
import { openSuggestionMenu, writeInEditor } from './utils-editor';

/**
 * A version is at least a minute of editing: the collaboration server groups
 * changes that are less than a minute apart, and the panel merges what is left
 * across authors. That bound is the feature — a history of every few keystrokes
 * is not a history — but it does mean a test cannot produce two versions
 * without a minute of real time passing. The timestamps come from the server,
 * so no clock can be faked to shorten it.
 *
 * The tests below therefore assert one version wherever one is enough, and only
 * the restore test pays for a second one.
 */
const VERSION_GRANULARITY_MS = 60_000;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('Doc Version', () => {
  test('it displays an empty history', async ({ page, browserName }) => {
    // Stubbed, because a document with no history at all cannot be reached
    // through the interface: opening one writes to it, and that write is a
    // change like any other. Only a document nobody has ever opened has an
    // empty timeline.
    await page.route('**/collaboration/activity/**', (route) =>
      route.fulfill({ json: { activity: [] } }),
    );

    await createDoc(page, 'doc-version-empty', browserName, 1);

    await page.getByLabel('Open the document options').click();
    await page.getByRole('menuitem', { name: 'Version history' }).click();

    const modal = page.getByRole('dialog', { name: 'Version history' });
    await expect(modal.getByLabel('Version list')).toBeVisible();
    await expect(modal.getByText('No versions')).toBeVisible();
  });

  test('it displays the doc versions', async ({ page, browserName }) => {
    const [randomDoc] = await createDoc(page, 'doc-version', browserName, 1);

    // Initially, there is no version
    await page.getByLabel('Open the document options').click();
    await page.getByRole('menuitem', { name: 'History' }).click();
    await expect(page.getByText('History', { exact: true })).toBeVisible();

    const modal = page.getByRole('dialog', { name: 'Version history' });
    const panel = modal.getByLabel('Version list');

    await writeInEditor({ page, text: 'Hello World' });

    const { suggestionMenu } = await openSuggestionMenu({ page });
    await suggestionMenu.getByText('Add a callout block').click();

    const calloutBlock = page
      .locator('div[data-content-type="callout"]')
      .first();

    await expect(calloutBlock).toBeVisible();

    await reopenDoc(page, randomDoc);

    await expect(page.getByText('Hello World')).toBeVisible();

    await page.getByLabel('Open the document options').click();
    await page.getByRole('menuitem', { name: 'History' }).click();

    await expect(panel).toBeVisible();
    await expect(page.getByText('History', { exact: true })).toBeVisible();
    await expect(page.getByRole('status')).toBeHidden();

    // One entry: opening the document, naming it and typing into it all
    // happened inside one minute, and a version is a minute of editing.
    const items = panel.locator('.version-item');
    await expect(items).toHaveCount(1);

    await items.nth(0).click();

    // the preview renders the document as it stood at the end of that version
    await expect(modal.getByText('Hello World')).toBeVisible();
    await expect(
      modal.locator('div[data-content-type="callout"]').first(),
    ).toBeVisible();
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
    await expect(page.getByRole('menuitem', { name: 'History' })).toBeHidden();
  });

  test('it restores the doc version', async ({ page, browserName }) => {
    // The wait below is the whole reason for this budget, and it is not
    // padding: two versions cannot exist any closer together. See the note at
    // the top of the file before trying to make this faster.
    test.setTimeout(VERSION_GRANULARITY_MS + 120_000);

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

    await reopenDoc(page, randomDoc);
    await expect(editor.getByText('Hello')).toBeVisible();

    // Let the first version close before writing the text that has to end up
    // in a second one — a minute of silence is what separates them.
    await page.waitForTimeout(VERSION_GRANULARITY_MS + 1_000);

    await page.locator('.bn-block-outer').last().click();
    await page.keyboard.press('Enter');
    await page.locator('.bn-block-outer').last().fill('World');

    await reopenDoc(page, randomDoc);

    await expect(page.getByText('World')).toBeVisible();

    await page.getByLabel('Open the document options').click();
    await page.getByRole('menuitem', { name: 'History' }).click();

    const modal = page.getByRole('dialog', { name: 'Version history' });
    const panel = modal.getByLabel('Version list');
    await expect(panel).toBeVisible();
    await expect(page.getByText('History', { exact: true })).toBeVisible();

    // newest first: the second item is the version that predates 'World'
    const items = panel.locator('.version-item');
    await expect(items).toHaveCount(2);
    await items.nth(1).click();

    await expect(modal.getByText('Hello')).toBeVisible();
    await expect(modal.getByText('World')).toBeHidden();

    await page.getByRole('button', { name: 'Restore', exact: true }).click();
    await expect(
      page.getByText(
        "The current document will be replaced, but you'll still find it in the version history.",
      ),
    ).toBeVisible();

    await page.getByLabel('Restore', { exact: true }).click();

    // The collaboration server applies the rollback and pushes it back over the
    // connection this editor is already holding — nothing is reloaded here.
    const mainEditor = page.getByLabel('Document editor');

    await expect(mainEditor.getByText('Hello')).toBeVisible();
    await expect(mainEditor.getByText('World')).toBeHidden();

    // The comment survives, and that is the point: a restore undoes the changes
    // made after the chosen version rather than replacing the document with an
    // old copy of it. This comment belongs to the version being restored, so
    // nothing about it was undone.
    await expect(mainEditor.getByText('Hello')).toHaveClass('bn-thread-mark');

    // and the document is still live afterwards
    await mainEditor.getByText('Hello').click();
    await expect(thread.getByText('This is a comment').first()).toBeVisible();
  });
});
