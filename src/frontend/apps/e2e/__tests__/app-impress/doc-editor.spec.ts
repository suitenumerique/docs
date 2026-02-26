import path from 'path';

import { expect, test } from '@playwright/test';
import cs from 'convert-stream';

import {
  createDoc,
  goToGridDoc,
  overrideConfig,
  verifyDocName,
} from './utils-common';
import { getEditor, openSuggestionMenu, writeInEditor } from './utils-editor';
import { connectOtherUserToDoc, updateShareLink } from './utils-share';
import {
  createRootSubPage,
  getTreeRow,
  navigateToPageFromTree,
} from './utils-sub-pages';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('Doc Editor', () => {
  test('it checks toolbar buttons are displayed', async ({
    page,
    browserName,
  }) => {
    await createDoc(page, 'doc-toolbar', browserName, 1);

    const editor = await writeInEditor({ page, text: 'test content' });

    await editor
      .getByText('test content', {
        exact: true,
      })
      .selectText();

    const toolbar = page.locator('.bn-formatting-toolbar');
    await expect(toolbar.getByRole('button', { name: 'Ask AI' })).toBeVisible();
    await expect(
      toolbar.locator('button[data-test="comment-toolbar-button"]'),
    ).toBeVisible();
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
    await expect(
      toolbar.locator('button[data-test="convertMarkdown"]'),
    ).toBeVisible();

    await page.keyboard.press('Escape');

    await page.locator('.bn-block-outer').last().click();

    await page.keyboard.press('Enter');

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('.bn-block-outer').last().fill('/');
    await page.getByText('Resizable image with caption').click();
    await page.getByText('Upload image').click();

    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(
      path.join(__dirname, 'assets/logo-suite-numerique.png'),
    );

    const image = page
      .locator('.--docs--editor-container img.bn-visual-media')
      .first();

    await expect(image).toHaveAttribute('role', 'presentation');

    await image.click();

    await expect(toolbar.getByRole('button', { name: 'Ask AI' })).toBeHidden();
    await expect(
      toolbar.locator('button[data-test="comment-toolbar-button"]'),
    ).toBeHidden();
    await expect(
      toolbar.locator('button[data-test="convertMarkdown"]'),
    ).toBeHidden();

    await expect(
      toolbar.locator('button[data-test="editcaption"]'),
    ).toBeVisible();
    await expect(
      toolbar.locator('button[data-test="downloadfile"]'),
    ).toBeVisible();
  });

  /**
   * We check:
   *  - connection to the collaborative server
   *  - signal of the backend to the collaborative server (connection should close)
   *  - reconnection to the collaborative server
   */
  test('checks the connection with collaborative server', async ({ page }) => {
    let webSocketPromise = page.waitForEvent('websocket', (webSocket) => {
      return webSocket
        .url()
        .includes('ws://localhost:4444/collaboration/ws/?room=');
    });

    await page
      .getByRole('button', {
        name: 'New doc',
      })
      .click();

    let webSocket = await webSocketPromise;
    expect(webSocket.url()).toContain(
      'ws://localhost:4444/collaboration/ws/?room=',
    );

    // Is connected
    let framesentPromise = webSocket.waitForEvent('framesent');

    await writeInEditor({ page, text: 'Hello World' });

    let framesent = await framesentPromise;
    expect(framesent.payload).not.toBeNull();

    await page.getByRole('button', { name: 'Share' }).click();

    const selectVisibility = page.getByTestId('doc-visibility');

    // When the visibility is changed, the ws should close the connection (backend signal)
    const wsClosePromise = webSocket.waitForEvent('close');

    await selectVisibility.click();
    await page.getByRole('menuitem', { name: 'Connected' }).click();

    // Assert that the doc reconnects to the ws
    const wsClose = await wsClosePromise;
    expect(wsClose.isClosed()).toBeTruthy();

    // Check the ws is connected again
    webSocketPromise = page.waitForEvent('websocket', (webSocket) => {
      return webSocket
        .url()
        .includes('ws://localhost:4444/collaboration/ws/?room=');
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

    await editor.getByText('[test markdown]').selectText();
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

    await page.goto('/');
    await page
      .getByRole('button', {
        name: 'New doc',
      })
      .click();

    await expect(editor.getByText('Hello World Doc 1')).toBeHidden();
    await expect(editor.getByText('Hello World Doc 2')).toBeHidden();
  });

  test('it saves the doc when we change pages', async ({
    page,
    browserName,
  }) => {
    // Check the first doc
    const [doc] = await createDoc(page, 'doc-saves-change', browserName);
    await verifyDocName(page, doc);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await editor.fill('Hello World Doc persisted 1');
    await expect(editor.getByText('Hello World Doc persisted 1')).toBeVisible();

    const [secondDoc] = await createDoc(
      page,
      'doc-saves-change-other',
      browserName,
    );

    await verifyDocName(page, secondDoc);

    await goToGridDoc(page, {
      title: doc,
    });

    await verifyDocName(page, doc);
    await expect(editor.getByText('Hello World Doc persisted 1')).toBeVisible();
  });

  test('it saves the doc when we quit pages', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'This test is very flaky with webkit');

    // Check the first doc
    const [doc] = await createDoc(page, 'doc-quit-1', browserName, 1);
    await verifyDocName(page, doc);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await editor.fill('Hello World Doc persisted 2');
    await expect(editor.getByText('Hello World Doc persisted 2')).toBeVisible();

    await page.waitForTimeout(1000);

    const urlDoc = page.url();
    await page.goto(urlDoc);

    // Wait for editor to load
    await expect(editor).toBeVisible();
    await expect(editor.getByText('Hello World Doc persisted 2')).toBeVisible();
  });

  test('it cannot edit if viewer but see and can get resources', async ({
    page,
    browserName,
  }) => {
    const [docTitle] = await createDoc(page, 'doc-viewer', browserName, 1);
    await verifyDocName(page, docTitle);

    await writeInEditor({ page, text: 'Hello World' });

    await page.getByRole('button', { name: 'Share' }).click();
    await updateShareLink(page, 'Public', 'Reading');

    // Close the modal
    await page.getByRole('button', { name: 'close' }).first().click();

    const { otherPage, cleanup } = await connectOtherUserToDoc({
      browserName,
      docUrl: page.url(),
      withoutSignIn: true,
      docTitle,
    });

    await expect(
      otherPage.getByLabel('It is the card information').getByText('Reader'),
    ).toBeVisible();

    // Cannot edit
    const editor = otherPage.locator('.ProseMirror');
    await expect(editor).toHaveAttribute('contenteditable', 'false');

    // Owner add a image
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('.bn-block-outer').last().fill('/');
    await page.getByText('Resizable image with caption').click();
    await page.getByText('Upload image').click();

    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(
      path.join(__dirname, 'assets/logo-suite-numerique.png'),
    );

    // Owner see the image
    await expect(
      page.locator('.--docs--editor-container img.bn-visual-media').first(),
    ).toBeVisible();

    // Viewser see the image
    const viewerImg = otherPage
      .locator('.--docs--editor-container img.bn-visual-media')
      .first();
    await expect(viewerImg).toBeVisible();

    // Viewer can download the image
    await viewerImg.click();
    const downloadPromise = otherPage.waitForEvent('download');
    await otherPage.getByRole('button', { name: 'Download image' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('logo-suite-numerique.png');

    await cleanup();
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

    const image = page
      .locator('.--docs--editor-container img.bn-visual-media')
      .first();

    await expect(image).toBeVisible();

    // Wait for the media-check to be processed

    await page.waitForTimeout(1000);

    // Check src of image
    expect(await image.getAttribute('src')).toMatch(
      /http:\/\/localhost:8083\/media\/.*\/attachments\/.*.png/,
    );

    await expect(image).toHaveAttribute('role', 'presentation');
    await expect(image).toHaveAttribute('alt', '');
    await expect(image).toHaveAttribute('tabindex', '-1');
    await expect(image).toHaveAttribute('aria-hidden', 'true');
  });

  test('it downloads unsafe files', async ({ page, browserName }) => {
    const [randomDoc] = await createDoc(page, 'doc-editor', browserName, 1);

    const fileChooserPromise = page.waitForEvent('filechooser');
    const downloadPromise = page.waitForEvent('download', (download) => {
      return download.suggestedFilename().includes(`html`);
    });
    const responseCheckPromise = page.waitForResponse(
      (response) =>
        response.url().includes('media-check') && response.status() === 200,
    );

    await verifyDocName(page, randomDoc);

    await page.locator('.ProseMirror.bn-editor').click();
    await page.locator('.ProseMirror.bn-editor').fill('Hello World');

    await page.keyboard.press('Enter');
    await page.locator('.bn-block-outer').last().fill('/');
    await page.getByText('Embedded file').click();
    await page.getByText('Upload file').click();

    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(__dirname, 'assets/test.html'));

    await responseCheckPromise;

    await page.locator('.bn-block-content[data-name="test.html"]').click();
    await page.getByRole('button', { name: 'Download file' }).click();

    await expect(
      page.getByText('This file is flagged as unsafe.'),
    ).toBeVisible();

    await expect(
      page.getByRole('button', {
        name: 'Download',
        exact: true,
      }),
    ).toBeVisible();

    void page
      .getByRole('button', {
        name: 'Download',
        exact: true,
      })
      .click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain(`-unsafe.html`);

    const svgBuffer = await cs.toBuffer(await download.createReadStream());
    expect(svgBuffer.toString()).toContain('Hello svg');
  });

  test('it analyzes uploads', async ({ page, browserName }) => {
    const [randomDoc] = await createDoc(page, 'doc-editor', browserName, 1);

    let requestCount = 0;
    await page.route(
      /.*\/documents\/.*\/media-check\/\?key=.*/,
      async (route) => {
        const request = route.request();
        if (request.method().includes('GET')) {
          await route.fulfill({
            json: {
              status: requestCount > 1 ? 'ready' : 'processing',
              file: '/anything.html',
            },
          });

          requestCount++;
        } else {
          await route.continue();
        }
      },
    );

    const fileChooserPromise = page.waitForEvent('filechooser');

    await verifyDocName(page, randomDoc);

    const { editor } = await openSuggestionMenu({ page });
    await page.getByText('Embedded file').click();
    await page.getByText('Upload file').click();

    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(__dirname, 'assets/test.html'));

    await expect(editor.getByText('Analyzing file...')).toBeVisible();

    // To be sure the retry happens even after a page reload
    await page.reload();

    await expect(editor.getByText('Analyzing file...')).toBeVisible();

    // The retry takes a few seconds
    await expect(editor.getByText('test.html')).toBeVisible({
      timeout: 7000,
    });
    await expect(editor.getByText('Analyzing file...')).toBeHidden();
  });

  test('it checks block editing when not connected to collab server', async ({
    page,
    browserName,
  }) => {
    test.slow();

    /**
     * The good port is 4444, but we want to simulate a not connected
     * collaborative server.
     * So we use a port that is not used by the collaborative server.
     * The server will not be able to connect to the collaborative server.
     */
    await overrideConfig(page, {
      COLLABORATION_WS_URL: 'ws://localhost:5555/collaboration/ws/',
    });

    await page.goto('/');

    const [parentTitle] = await createDoc(
      page,
      'editing-blocking',
      browserName,
      1,
    );

    const card = page.getByLabel('It is the card information');
    await expect(
      card.getByText('Others are editing. Your network prevent changes.'),
    ).toBeHidden();
    const editor = page.locator('.ProseMirror');

    await expect(editor).toHaveAttribute('contenteditable', 'true');

    let responseCanEditPromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/can-edit/`) && response.status() === 200,
    );

    await page.getByRole('button', { name: 'Share' }).click();

    await updateShareLink(page, 'Public', 'Editing');

    // Close the modal
    await page.getByRole('button', { name: 'close' }).first().click();

    const urlParentDoc = page.url();

    const { name: childTitle } = await createRootSubPage(
      page,
      browserName,
      'editing-blocking - child',
    );

    let responseCanEdit = await responseCanEditPromise;
    expect(responseCanEdit.ok()).toBeTruthy();
    let jsonCanEdit = (await responseCanEdit.json()) as { can_edit: boolean };
    expect(jsonCanEdit.can_edit).toBeTruthy();

    const urlChildDoc = page.url();

    /**
     * We open another browser that will connect to the collaborative server
     * and will block the current browser to edit the doc.
     */
    const { otherPage } = await connectOtherUserToDoc({
      browserName,
      docUrl: urlChildDoc,
      docTitle: childTitle,
      withoutSignIn: true,
    });

    const webSocketPromise = otherPage.waitForEvent(
      'websocket',
      (webSocket) => {
        return webSocket
          .url()
          .includes('ws://localhost:4444/collaboration/ws/?room=');
      },
    );

    await otherPage.goto(urlChildDoc);

    const webSocket = await webSocketPromise;
    expect(webSocket.url()).toContain(
      'ws://localhost:4444/collaboration/ws/?room=',
    );

    await verifyDocName(otherPage, childTitle);

    await page.reload();

    responseCanEditPromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/can-edit/`) && response.status() === 200,
    );

    responseCanEdit = await responseCanEditPromise;
    expect(responseCanEdit.ok()).toBeTruthy();

    jsonCanEdit = (await responseCanEdit.json()) as { can_edit: boolean };
    expect(jsonCanEdit.can_edit).toBeFalsy();

    await expect(
      card.getByText('Others are editing. Your network prevent changes.'),
    ).toBeVisible({
      timeout: 10000,
    });

    await expect(editor).toHaveAttribute('contenteditable', 'false');

    await expect(
      page.getByRole('textbox', { name: 'Document title' }),
    ).toBeHidden();
    await expect(page.getByRole('heading', { name: childTitle })).toBeVisible();

    await page.goto(urlParentDoc);

    await verifyDocName(page, parentTitle);

    await page.getByRole('button', { name: 'Share' }).click();

    await page.getByTestId('doc-access-mode').click();
    await page.getByRole('menuitem', { name: 'Reading' }).click();

    // Close the modal
    await page.getByRole('button', { name: 'close' }).first().click();

    await page.goto(urlChildDoc);

    await expect(editor).toHaveAttribute('contenteditable', 'true');

    await expect(
      page.getByRole('textbox', { name: 'Document title' }),
    ).toContainText(childTitle);
    await expect(page.getByRole('heading', { name: childTitle })).toBeHidden();

    await expect(
      card.getByText('Others are editing. Your network prevent changes.'),
    ).toBeHidden();
  });

  test('it checks if callout custom block', async ({ page, browserName }) => {
    await createDoc(page, 'doc-toolbar', browserName, 1);

    await openSuggestionMenu({ page });
    await page.getByText('Add a callout block').click();

    const calloutBlock = page
      .locator('div[data-content-type="callout"]')
      .first();

    await expect(calloutBlock).toBeVisible();

    await calloutBlock.locator('.inline-content').fill('example text');

    await expect(
      page.locator('.bn-block-content[data-content-type="callout"]').first(),
    ).toHaveAttribute('data-background-color', 'yellow');

    const emojiButton = calloutBlock.getByRole('button');
    await expect(emojiButton).toHaveText('💡');
    await emojiButton.click();
    // Group smiley
    await expect(page.getByRole('button', { name: '🤠' })).toBeVisible();
    // Group animals
    await page.getByText('Animals & Nature').scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: '🦆' })).toBeVisible();
    // Group travel
    await page.getByText('Travel & Places').scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: '🚝' })).toBeVisible();
    // Group objects
    await page.getByText('Objects').scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: '🪇' })).toBeVisible();
    // Group symbol
    await page.getByText('Symbols').scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: '🛃' })).toBeVisible();

    await page.keyboard.press('Escape');

    await page.locator('.bn-side-menu > button').last().click();
    await page.locator('.mantine-Menu-dropdown > button').last().click();
    await page.locator('.bn-color-picker-dropdown > button').last().click();

    await expect(
      page.locator('.bn-block-content[data-content-type="callout"]').first(),
    ).toHaveAttribute('data-background-color', 'pink');
  });

  test('it checks interlink feature', async ({ page, browserName }) => {
    const [randomDoc] = await createDoc(page, 'doc-interlink', browserName, 1);

    await verifyDocName(page, randomDoc);

    const { name: docChild1 } = await createRootSubPage(
      page,
      browserName,
      'doc-interlink-child-1',
    );

    await verifyDocName(page, docChild1);

    const { name: docChild2 } = await createRootSubPage(
      page,
      browserName,
      'doc-interlink-child-2',
    );

    await verifyDocName(page, docChild2);

    const treeRow = await getTreeRow(page, docChild2);
    await treeRow.locator('.--docs--doc-icon').click();
    await page.getByRole('button', { name: '😀' }).first().click();

    await navigateToPageFromTree({ page, title: docChild1 });

    await openSuggestionMenu({ page });
    await page.getByText('Link a doc').first().click();

    const input = page.locator(
      "span[data-inline-content-type='interlinkingSearchInline'] input",
    );
    const searchContainer = page.locator('.quick-search-container');

    await input.fill('doc-interlink');

    await expect(searchContainer.getByText(randomDoc)).toBeVisible();
    await expect(searchContainer.getByText(docChild1)).toBeVisible();
    await expect(searchContainer.getByText(docChild2)).toBeVisible();

    const searchContainerRow = searchContainer
      .getByRole('option')
      .filter({
        hasText: docChild2,
      })
      .first();

    await expect(searchContainerRow).toContainText('😀');
    await expect(searchContainerRow.locator('svg').first()).toBeHidden();

    await input.pressSequentially('-child');

    await expect(searchContainer.getByText(docChild1)).toBeVisible();
    await expect(searchContainer.getByText(docChild2)).toBeVisible();
    await expect(searchContainer.getByText(randomDoc)).toBeHidden();

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    // Wait for the search container to disappear, indicating selection was made
    await expect(searchContainer).toBeHidden();

    // Wait for the interlink to be created and rendered
    const editor = await getEditor({ page });

    const interlinkChild = editor
      .locator('.--docs--interlinking-link-inline-content')
      .first();

    await expect(interlinkChild).toBeVisible({ timeout: 10000 });
    await expect(interlinkChild).toContainText('😀');
    await expect(interlinkChild).toContainText(docChild2);
    await expect(interlinkChild.locator('svg').first()).toBeHidden();
    await interlinkChild.click();

    // wait for navigation to complete
    await page.waitForTimeout(1000);

    await verifyDocName(page, docChild2);

    await editor.click();

    await page.keyboard.press('@');
    await input.fill(docChild1);
    await searchContainer.getByText(docChild1).click();

    await expect(interlinkChild).toContainText(docChild1);
    await expect(interlinkChild).toBeVisible({ timeout: 10000 });
    await expect(interlinkChild.locator('svg').first()).toBeVisible();

    await page.keyboard.press('@');

    await page.keyboard.press('Escape');

    await expect(editor.getByText('@')).toBeVisible();
  });

  test('it checks multiple big doc scroll to the top', async ({
    page,
    browserName,
  }) => {
    const [randomDoc] = await createDoc(page, 'doc-scroll', browserName, 1);

    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Enter');
      await writeInEditor({ page, text: 'Hello Parent ' + i });
    }

    const editor = await getEditor({ page });
    await expect(
      editor.getByText('Hello Parent 1', { exact: true }),
    ).not.toBeInViewport();
    await expect(editor.getByText('Hello Parent 14')).toBeInViewport();

    const { name: docChild } = await createRootSubPage(
      page,
      browserName,
      'doc-scroll-child',
    );

    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Enter');
      await writeInEditor({ page, text: 'Hello Child ' + i });
    }

    await expect(
      editor.getByText('Hello Child 1', { exact: true }),
    ).not.toBeInViewport();
    await expect(editor.getByText('Hello Child 14')).toBeInViewport();

    await navigateToPageFromTree({ page, title: randomDoc });

    await expect(
      editor.getByText('Hello Parent 1', { exact: true }),
    ).toBeInViewport();
    await expect(editor.getByText('Hello Parent 14')).not.toBeInViewport();

    await navigateToPageFromTree({ page, title: docChild });

    await expect(
      editor.getByText('Hello Child 1', { exact: true }),
    ).toBeInViewport();
    await expect(editor.getByText('Hello Child 14')).not.toBeInViewport();
  });

  test('it embeds PDF', async ({ page, browserName }) => {
    await createDoc(page, 'doc-toolbar', browserName, 1);

    await page.getByRole('button', { name: 'Share' }).click();
    await updateShareLink(page, 'Public', 'Reading');

    await page.getByRole('button', { name: 'Close the share modal' }).click();

    await openSuggestionMenu({ page });
    await page.getByText('Embed a PDF file').click();

    const pdfBlock = page.locator('div[data-content-type="pdf"]').last();

    await expect(pdfBlock).toBeVisible();

    // Try with invalid PDF first
    await page
      .getByText(/Add (PDF|file)/)
      .first()
      .click();

    await page.locator('[data-test="embed-tab"]').click();

    await page
      .locator('[data-test="embed-input"]')
      .fill('https://example.test/test.test');

    await page.locator('[data-test="embed-input-button"]').click();

    await expect(page.getByText('Invalid or missing PDF file')).toBeVisible();

    await openSuggestionMenu({ page });
    await page.getByText('Embed a PDF file').click();

    // Now with a valid PDF
    await page.getByText(/Add (PDF|file)/).click();
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByText(/Upload (PDF|file)/).click();
    const fileChooser = await fileChooserPromise;

    await fileChooser.setFiles(path.join(__dirname, 'assets/test-pdf.pdf'));

    // Wait for the media-check to be processed
    await page.waitForTimeout(1000);

    const pdfIframe = page
      .locator('.--docs--editor-container iframe.bn-visual-media')
      .first();

    // Check src of pdf
    expect(await pdfIframe.getAttribute('src')).toMatch(
      /http:\/\/localhost:8083\/media\/.*\/attachments\/.*.pdf/,
    );

    await expect(pdfIframe).toHaveAttribute('role', 'presentation');
  });

  test('it preserves text when switching between mobile and desktop views', async ({
    page,
    browserName,
  }) => {
    const [docTitle] = await createDoc(
      page,
      'doc-viewport-test',
      browserName,
      1,
    );
    await verifyDocName(page, docTitle);

    const editor = await writeInEditor({
      page,
      text: 'Hello World - Desktop Text',
    });
    await expect(editor.getByText('Hello World - Desktop Text')).toBeVisible();

    await page.waitForTimeout(500);

    // Switch to mobile viewport
    await page.setViewportSize({ width: 500, height: 1200 });
    await page.waitForTimeout(500);

    await expect(editor.getByText('Hello World - Desktop Text')).toBeVisible();

    await writeInEditor({
      page,
      text: 'Mobile Text',
    });

    await page.waitForTimeout(500);

    // Switch back to desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(500);

    await expect(editor.getByText('Mobile Text')).toBeVisible();
  });
});
