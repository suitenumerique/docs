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

    const panel = page.getByLabel('Document panel');

    await expect(panel.getByText('Current version')).toBeVisible();
    expect(await panel.locator('li').count()).toBe(1);

    await page.locator('.ProseMirror.bn-editor').click();
    await page.locator('.ProseMirror.bn-editor').last().fill('Hello World');

    await goToGridDoc(page, {
      title: randomDoc,
    });

    await expect(page.getByText('Hello World')).toBeVisible();

    await page
      .locator('.ProseMirror .bn-block')
      .getByText('Hello World')
      .fill('It will create a version');

    await goToGridDoc(page, {
      title: randomDoc,
    });

    await expect(page.getByText('Hello World')).toBeHidden();
    await expect(page.getByText('It will create a version')).toBeVisible();

    await page.getByLabel('Open the document options').click();
    await page
      .getByRole('button', {
        name: 'Version history',
      })
      .click();

    await expect(panel.getByText('Current version')).toBeVisible();
    expect(await panel.locator('li').count()).toBe(2);

    await panel.locator('li').nth(1).click();
    await expect(
      page.getByText('Read only, you cannot edit document versions.'),
    ).toBeVisible();
    await expect(page.getByText('Hello World')).toBeVisible();
    await expect(page.getByText('It will create a version')).toBeHidden();

    await panel.getByText('Current version').click();
    await expect(page.getByText('Hello World')).toBeHidden();
    await expect(page.getByText('It will create a version')).toBeVisible();
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

    await page.getByRole('button', { name: 'Table of content' }).click();

    await expect(
      page.getByLabel('Document panel').getByText('Versions'),
    ).toBeHidden();
  });

  test('it restores the doc version', async ({ page, browserName }) => {
    const [randomDoc] = await createDoc(page, 'doc-version', browserName, 1);
    await verifyDocName(page, randomDoc);

    await page.locator('.bn-block-outer').last().click();
    await page.locator('.bn-block-outer').last().fill('Hello');

    expect(true).toBe(true);
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

    const panel = page.getByLabel('Document panel');
    await panel.locator('li').nth(1).click();
    await expect(page.getByText('World')).toBeHidden();

    await panel.getByLabel('Open the version options').click();
    await page.getByText('Restore the version').click();

    await expect(page.getByText('Restore this version?')).toBeVisible();

    await page
      .getByRole('button', {
        name: 'Restore',
      })
      .click();

    await expect(panel.locator('li')).toHaveCount(3);

    await panel.getByText('Current version').click();
    await expect(page.getByText('Hello')).toBeVisible();
    await expect(page.getByText('World')).toBeHidden();
  });

  test('it restores the doc version from button title', async ({
    page,
    browserName,
  }) => {
    const [randomDoc] = await createDoc(page, 'doc-version', browserName, 1);

    await verifyDocName(page, randomDoc);

    const editor = page.locator('.ProseMirror');
    await editor.locator('.bn-block-outer').last().click();
    await editor.locator('.bn-block-outer').last().fill('Hello');

    await goToGridDoc(page, {
      title: randomDoc,
    });

    await expect(editor.getByText('Hello')).toBeVisible();
    await editor.locator('.bn-block-outer').last().click();
    await page.keyboard.press('Enter');
    await editor.locator('.bn-block-outer').last().fill('World');

    await goToGridDoc(page, {
      title: randomDoc,
    });

    await expect(editor.getByText('World')).toBeVisible();

    await page.getByLabel('Open the document options').click();
    await page
      .getByRole('button', {
        name: 'Version history',
      })
      .click();

    const panel = page.getByLabel('Document panel');
    await panel.locator('li').nth(1).click();
    await expect(editor.getByText('World')).toBeHidden();

    await page
      .getByRole('button', {
        name: 'Restore this version',
      })
      .click();

    await expect(page.getByText('Restore this version?')).toBeVisible();

    await page
      .getByRole('button', {
        name: 'Restore',
      })
      .click();

    await expect(panel.locator('li')).toHaveCount(3);

    await panel.getByText('Current version').click();
    await expect(editor.getByText('Hello')).toBeVisible();
    await expect(editor.getByText('World')).toBeHidden();
  });
});
