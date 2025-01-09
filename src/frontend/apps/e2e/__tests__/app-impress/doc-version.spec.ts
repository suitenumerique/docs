import { expect, test } from '@playwright/test';

import {
  createDoc,
  goToGridDoc,
  mockedDocument,
  verifyDocName,
} from './common';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('Doc Version', () => {
  test('it displays the doc versions', async ({ page, browserName }) => {
    const [randomDoc] = await createDoc(page, 'doc-version', browserName, 1);

    await verifyDocName(page, randomDoc);

    await page.getByLabel('Open the document options').click();
    await page
      .getByRole('button', {
        name: 'Version history',
      })
      .click();
    await expect(page.getByText('History', { exact: true })).toBeVisible();

    const modal = page.getByLabel('version history modal');
    const panel = modal.getByLabel('version list');
    await expect(panel).toBeVisible();
    await expect(modal.getByText('No versions')).toBeVisible();

    const editor = page.locator('.ProseMirror');
    await modal.getByRole('button', { name: 'close' }).click();
    await editor.click();
    await page.keyboard.type('# Hello World');

    await goToGridDoc(page, {
      title: randomDoc,
    });

    await expect(
      page.getByRole('heading', { name: 'Hello World' }),
    ).toBeVisible();

    await page
      .locator('.ProseMirror .bn-block')
      .getByRole('heading', { name: 'Hello World' })
      .fill('It will create a version');

    await goToGridDoc(page, {
      title: randomDoc,
    });

    await expect(page.getByText('Hello World')).toBeHidden();
    await expect(
      page.getByRole('heading', { name: 'It will create a version' }),
    ).toBeVisible();

    await page.getByLabel('Open the document options').click();
    await page
      .getByRole('button', {
        name: 'Version history',
      })
      .click();

    await expect(panel).toBeVisible();
    await expect(page.getByText('History', { exact: true })).toBeVisible();
    await expect(page.getByRole('status')).toBeHidden();
    const items = await panel.locator('.version-item').all();
    expect(items.length).toBe(1);
    await items[0].click();

    await expect(modal.getByText('Hello World')).toBeVisible();
    await expect(modal.getByText('It will create a version')).toBeHidden();
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
      page.getByRole('button', { name: 'Version history' }),
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
    await page
      .getByRole('button', {
        name: 'Version history',
      })
      .click();

    const modal = page.getByLabel('version history modal');
    const panel = modal.getByLabel('version list');
    await expect(panel).toBeVisible();

    await expect(page.getByText('History', { exact: true })).toBeVisible();
    await expect(page.getByRole('status')).toBeVisible();
    await expect(page.getByRole('status')).toBeHidden();
    const items = await panel.locator('.version-item').all();
    expect(items.length).toBe(1);
    await items[0].click();

    await expect(modal.getByText('World')).toBeHidden();

    await page.getByRole('button', { name: 'Restore' }).click();
    await expect(page.getByText('Your current document will')).toBeVisible();
    await page.getByText('If a member is editing, his').click();

    await page.getByLabel('Restore', { exact: true }).click();

    await expect(page.getByText('Hello')).toBeVisible();
    await expect(page.getByText('World')).toBeHidden();
  });
});
