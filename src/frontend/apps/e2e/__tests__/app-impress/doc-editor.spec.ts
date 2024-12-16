import path from 'path';

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

test.describe('Doc Editor', () => {
  test('it check translations of the slash menu when changing language', async ({
    page,
    browserName,
  }) => {
    await createDoc(page, 'doc-toolbar', browserName, 1);

    const header = page.locator('header').first();
    const editor = page.locator('.ProseMirror');
    // Trigger slash menu to show english menu
    await editor.click();
    await editor.fill('/');
    await expect(page.getByText('Headings', { exact: true })).toBeVisible();
    await header.click();
    await expect(page.getByText('Headings', { exact: true })).toBeHidden();

    // Reset menu
    await editor.click();
    await editor.fill('');

    // Change language to French
    await header.click();
    await header.getByRole('combobox').getByText('English').click();
    await header.getByRole('option', { name: 'Français' }).click();
    await expect(
      header.getByRole('combobox').getByText('Français'),
    ).toBeVisible();

    // Trigger slash menu to show french menu
    await editor.click();
    await editor.fill('/');
    await expect(page.getByText('Titres', { exact: true })).toBeVisible();
    await header.click();
    await expect(page.getByText('Titres', { exact: true })).toBeHidden();
  });

  test('it checks default toolbar buttons are displayed', async ({
    page,
    browserName,
  }) => {
    await createDoc(page, 'doc-toolbar', browserName, 1);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await editor.fill('test content');

    await editor.getByText('test content').dblclick();

    const toolbar = page.locator('.bn-formatting-toolbar');
    await expect(toolbar.locator('button[data-test="bold"]')).toBeVisible();
    await expect(toolbar.locator('button[data-test="italic"]')).toBeVisible();
    await expect(
      toolbar.locator('button[data-test="underline"]'),
    ).toBeVisible();
    await expect(toolbar.locator('button[data-test="strike"]')).toBeVisible();
    await expect(
      toolbar.locator('button[data-test="alignTextLeft"]'),
    ).toBeVisible();
    await expect(
      toolbar.locator('button[data-test="alignTextCenter"]'),
    ).toBeVisible();
    await expect(
      toolbar.locator('button[data-test="alignTextRight"]'),
    ).toBeVisible();
    await expect(toolbar.locator('button[data-test="colors"]')).toBeVisible();
    await expect(
      toolbar.locator('button[data-test="unnestBlock"]'),
    ).toBeVisible();
    await expect(
      toolbar.locator('button[data-test="createLink"]'),
    ).toBeVisible();
  });

  /**
   * We check:
   *  - connection to the collaborative server
   *  - signal of the backend to the collaborative server (connection should close)
   *  - reconnection to the collaborative server
   */
  test('checks the connection with collaborative server', async ({
    page,
    browserName,
  }) => {
    let webSocketPromise = page.waitForEvent('websocket', (webSocket) => {
      return webSocket
        .url()
        .includes('ws://localhost:8083/collaboration/ws/?room=');
    });

    const randomDoc = await createDoc(page, 'doc-editor', browserName, 1);
    await verifyDocName(page, randomDoc[0]);

    let webSocket = await webSocketPromise;
    expect(webSocket.url()).toContain(
      'ws://localhost:8083/collaboration/ws/?room=',
    );

    // Is connected
    let framesentPromise = webSocket.waitForEvent('framesent');

    await page.locator('.ProseMirror.bn-editor').click();
    await page.locator('.ProseMirror.bn-editor').fill('Hello World');

    let framesent = await framesentPromise;
    expect(framesent.payload).not.toBeNull();

    await page.getByRole('button', { name: 'Share' }).click();

    const selectVisibility = page.getByLabel('Visibility', { exact: true });

    // When the visibility is changed, the ws should closed the connection (backend signal)
    const wsClosePromise = webSocket.waitForEvent('close');

    await selectVisibility.click();
    await page
      .getByRole('button', {
        name: 'Connected',
      })
      .click();

    // Assert that the doc reconnects to the ws
    const wsClose = await wsClosePromise;
    expect(wsClose.isClosed()).toBeTruthy();

    // Checkt the ws is connected again
    webSocketPromise = page.waitForEvent('websocket', (webSocket) => {
      return webSocket
        .url()
        .includes('ws://localhost:8083/collaboration/ws/?room=');
    });

    webSocket = await webSocketPromise;
    framesentPromise = webSocket.waitForEvent('framesent');
    framesent = await framesentPromise;
    expect(framesent.payload).not.toBeNull();
  });

  test('markdown button converts from markdown to the editor syntax json', async ({
    page,
    browserName,
  }) => {
    const randomDoc = await createDoc(page, 'doc-markdown', browserName, 1);

    await verifyDocName(page, randomDoc[0]);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await editor.fill('[test markdown](http://test-markdown.html)');

    await expect(editor.getByText('[test markdown]')).toBeVisible();

    await editor.getByText('[test markdown]').dblclick();
    await page.locator('button[data-test="convertMarkdown"]').click();

    await expect(editor.getByText('[test markdown]')).toBeHidden();
    await expect(
      editor.getByRole('link', {
        name: 'test markdown',
      }),
    ).toHaveAttribute('href', 'http://test-markdown.html');
  });

  test('it renders correctly when we switch from one doc to another', async ({
    page,
    browserName,
  }) => {
    // Check the first doc
    const [firstDoc] = await createDoc(page, 'doc-switch-1', browserName, 1);
    await verifyDocName(page, firstDoc);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await editor.fill('Hello World Doc 1');
    await expect(editor.getByText('Hello World Doc 1')).toBeVisible();

    // Check the second doc
    const [secondDoc] = await createDoc(page, 'doc-switch-2', browserName, 1);
    await verifyDocName(page, secondDoc);

    await expect(editor.getByText('Hello World Doc 1')).toBeHidden();
    await editor.click();
    await editor.fill('Hello World Doc 2');
    await expect(editor.getByText('Hello World Doc 2')).toBeVisible();

    // Check the first doc again
    await goToGridDoc(page, {
      title: firstDoc,
    });
    await verifyDocName(page, firstDoc);
    await expect(editor.getByText('Hello World Doc 2')).toBeHidden();
    await expect(editor.getByText('Hello World Doc 1')).toBeVisible();
  });

  test('it saves the doc when we change pages', async ({
    page,
    browserName,
  }) => {
    // Check the first doc
    const [doc] = await createDoc(page, 'doc-saves-change', browserName, 1);
    await verifyDocName(page, doc);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await editor.fill('Hello World Doc persisted 1');
    await expect(editor.getByText('Hello World Doc persisted 1')).toBeVisible();

    const secondDoc = await goToGridDoc(page, {
      nthRow: 2,
    });

    await verifyDocName(page, secondDoc);

    await goToGridDoc(page, {
      title: doc,
    });

    await expect(editor.getByText('Hello World Doc persisted 1')).toBeVisible();
  });

  test('it saves the doc when we quit pages', async ({ page, browserName }) => {
    // eslint-disable-next-line playwright/no-skipped-test
    test.skip(browserName === 'webkit', 'This test is very flaky with webkit');

    // Check the first doc
    const doc = await goToGridDoc(page);

    await verifyDocName(page, doc);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await editor.fill('Hello World Doc persisted 2');
    await expect(editor.getByText('Hello World Doc persisted 2')).toBeVisible();

    await page.goto('/');

    await goToGridDoc(page, {
      title: doc,
    });

    await expect(editor.getByText('Hello World Doc persisted 2')).toBeVisible();
  });

  test('it cannot edit if viewer', async ({ page }) => {
    await mockedDocument(page, {
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
    });

    await goToGridDoc(page);

    const card = page.getByLabel('It is the card information');
    await expect(card).toBeVisible();

    await expect(card.getByText('Reader')).toBeVisible();
  });

  test('it adds an image to the doc editor', async ({ page, browserName }) => {
    await createDoc(page, 'doc-image', browserName, 1);

    const fileChooserPromise = page.waitForEvent('filechooser');

    await page.locator('.bn-block-outer').last().fill('Hello World');

    await page.keyboard.press('Enter');
    await page.locator('.bn-block-outer').last().fill('/');
    await page.getByText('Resizable image with caption').click();
    await page.getByText('Upload image').click();

    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(
      path.join(__dirname, 'assets/logo-suite-numerique.png'),
    );

    const image = page.getByRole('img', { name: 'logo-suite-numerique.png' });

    await expect(image).toBeVisible();

    // Check src of image
    expect(await image.getAttribute('src')).toMatch(
      /http:\/\/localhost:8083\/media\/.*\/attachments\/.*.png/,
    );
  });

  test('it checks the AI buttons', async ({ page, browserName }) => {
    await page.route(/.*\/ai-translate\//, async (route) => {
      const request = route.request();
      if (request.method().includes('POST')) {
        await route.fulfill({
          json: {
            answer: 'Bonjour le monde',
          },
        });
      } else {
        await route.continue();
      }
    });

    await createDoc(page, 'doc-ai', browserName, 1);

    await page.locator('.bn-block-outer').last().fill('Hello World');

    const editor = page.locator('.ProseMirror');
    await editor.getByText('Hello').dblclick();

    await page.getByRole('button', { name: 'AI' }).click();

    await expect(
      page.getByRole('menuitem', { name: 'Use as prompt' }),
    ).toBeVisible();
    await expect(
      page.getByRole('menuitem', { name: 'Rephrase' }),
    ).toBeVisible();
    await expect(
      page.getByRole('menuitem', { name: 'Summarize' }),
    ).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Correct' })).toBeVisible();
    await expect(
      page.getByRole('menuitem', { name: 'Language' }),
    ).toBeVisible();

    await page.getByRole('menuitem', { name: 'Language' }).hover();
    await expect(
      page.getByRole('menuitem', { name: 'English', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('menuitem', { name: 'French', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('menuitem', { name: 'German', exact: true }),
    ).toBeVisible();

    await page.getByRole('menuitem', { name: 'English', exact: true }).click();

    await expect(editor.getByText('Bonjour le monde')).toBeVisible();
  });
});
