import { expect, test } from '@playwright/test';

import {
  createDoc,
  goToGridDoc,
  mockedDocument,
  verifyDocName,
} from './utils-common';
import { openSuggestionMenu, writeInEditor } from './utils-editor';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('Doc Version', () => {
  test('it displays the doc versions', async ({ page, browserName }) => {
    const [randomDoc] = await createDoc(page, 'doc-version', browserName, 1);

    await verifyDocName(page, randomDoc);

    // Initially, there is no version
    await page.getByLabel('Open the document options').click();
    await page.getByRole('menuitem', { name: 'Version history' }).click();
    await expect(page.getByText('History', { exact: true })).toBeVisible();

    const modal = page.getByLabel('version history modal');
    const panel = modal.getByLabel('version list');
    await expect(panel).toBeVisible();
    await expect(modal.getByText('No versions')).toBeVisible();

    await modal.getByRole('button', { name: 'close' }).click();

    await writeInEditor({ page, text: 'Hello World' });

    // It will trigger a save, no version created yet (initial version is not counted)
    await goToGridDoc(page, {
      title: randomDoc,
    });

    await expect(page.getByText('Hello World')).toBeVisible();

    // Write more
    await writeInEditor({ page, text: 'It will create a version' });

    await openSuggestionMenu({ page });
    await page.getByText('Add a callout block').click();

    const calloutBlock = page
      .locator('div[data-content-type="callout"]')
      .first();

    await expect(calloutBlock).toBeVisible();

    // It will trigger a save and create a version this time
    await goToGridDoc(page, {
      title: randomDoc,
    });

    await expect(page.getByText('Hello World')).toBeHidden();
    await expect(page.getByText('It will create a version')).toBeVisible();

    await expect(calloutBlock).toBeVisible();

    // Write more
    await writeInEditor({ page, text: 'It will create a second version' });

    // It will trigger a save and create a second version
    await goToGridDoc(page, {
      title: randomDoc,
    });

    await expect(
      page.getByText('It will create a second version'),
    ).toBeVisible();

    await page.getByLabel('Open the document options').click();
    await page.getByRole('menuitem', { name: 'Version history' }).click();

    await expect(panel).toBeVisible();
    await expect(page.getByText('History', { exact: true })).toBeVisible();
    await expect(page.getByRole('status')).toBeHidden();
    const items = await panel.locator('.version-item').all();
    expect(items.length).toBe(2);
    await items[1].click();

    await expect(modal.getByText('Hello World')).toBeVisible();
    await expect(modal.getByText('It will create a version')).toBeHidden();
    await expect(
      modal.locator('div[data-content-type="callout"]').first(),
    ).toBeHidden();

    await items[0].click();

    await expect(modal.getByText('Hello World')).toBeVisible();
    await expect(modal.getByText('It will create a version')).toBeVisible();
    await expect(
      modal.locator('div[data-content-type="callout"]').first(),
    ).toBeVisible();
    await expect(
      modal.getByText('It will create a second version'),
    ).toBeHidden();

    await items[1].click();

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
    ).toBeDisabled();
  });

  test('it restores the doc version', async ({ page, browserName }) => {
    const [randomDoc] = await createDoc(page, 'doc-version', browserName, 1);
    await verifyDocName(page, randomDoc);

    await page.locator('.bn-block-outer').last().click();
    await page.locator('.bn-block-outer').last().fill('Hello');

    await goToGridDoc(page, {
      title: randomDoc,
    });

    const editor = page.locator('.ProseMirror');
    await expect(editor.getByText('Hello')).toBeVisible();
    await page.locator('.bn-block-outer').last().click();
    await page.keyboard.press('Enter');
    await page.locator('.bn-block-outer').last().fill('World');

    await goToGridDoc(page, {
      title: randomDoc,
    });

    await expect(page.getByText('World')).toBeVisible();

    await page.getByLabel('Open the document options').click();
    await page.getByRole('menuitem', { name: 'Version history' }).click();

    const modal = page.getByLabel('version history modal');
    const panel = modal.getByLabel('version list');
    await expect(panel).toBeVisible();

    await expect(page.getByText('History', { exact: true })).toBeVisible();
    await panel.getByRole('button', { name: 'version item' }).click();

    await expect(modal.getByText('World')).toBeHidden();

    await page.getByRole('button', { name: 'Restore' }).click();
    await expect(page.getByText('Your current document will')).toBeVisible();
    await page.getByText('If a member is editing, his').click();

    await page.getByLabel('Restore', { exact: true }).click();

    await expect(page.getByText('Hello')).toBeVisible();
    await expect(page.getByText('World')).toBeHidden();
  });
});
