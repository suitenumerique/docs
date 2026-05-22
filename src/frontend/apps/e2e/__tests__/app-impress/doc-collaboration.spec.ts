import path from 'path';

import { expect, test } from '@playwright/test';

import { createDoc, overrideConfig, verifyDocName } from './utils-common';
import { openSuggestionMenu, writeInEditor } from './utils-editor';
import { connectOtherUserToDoc, updateShareLink } from './utils-share';
import { createRootSubPage } from './utils-sub-pages';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('Doc Collaboration', () => {
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
        .includes(`${process.env.COLLABORATION_WS_URL}?room=`);
    });

    await page
      .getByRole('button', {
        name: 'New doc',
      })
      .click();

    let webSocket = await webSocketPromise;
    expect(webSocket.url()).toContain(
      `${process.env.COLLABORATION_WS_URL}?room=`,
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
    await page.getByRole('menuitemradio', { name: 'Connected' }).click();

    // Assert that the doc reconnects to the ws
    const wsClose = await wsClosePromise;
    expect(wsClose.isClosed()).toBeTruthy();

    // Check the ws is connected again
    webSocket = await page.waitForEvent('websocket', (webSocket) => {
      return webSocket
        .url()
        .includes(`${process.env.COLLABORATION_WS_URL}?room=`);
    });
    framesentPromise = webSocket.waitForEvent('framesent');
    framesent = await framesentPromise;
    expect(framesent.payload).not.toBeNull();
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
    await openSuggestionMenu({
      page,
      suggestion: 'Resizable image with caption',
    });
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
    await expect(viewerImg).toBeVisible({
      timeout: 10000,
    });

    // Viewer can download the image
    await viewerImg.click();
    const downloadPromise = otherPage.waitForEvent('download');
    await otherPage.getByRole('button', { name: 'Download image' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('logo-suite-numerique.png');

    await cleanup();
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
      COLLABORATION_WS_NOT_CONNECTED_READY_ONLY: true,
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
    const { otherPage, cleanup } = await connectOtherUserToDoc({
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
          .includes(`${process.env.COLLABORATION_WS_URL}?room=`);
      },
    );

    await otherPage.goto(urlChildDoc);

    const webSocket = await webSocketPromise;
    expect(webSocket.url()).toContain(
      `${process.env.COLLABORATION_WS_URL}?room=`,
    );

    await verifyDocName(otherPage, childTitle);

    await page.reload();

    responseCanEdit = await page.waitForResponse(
      (response) =>
        response.url().includes(`/can-edit/`) && response.status() === 200,
    );
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
    await page.getByRole('menuitemradio', { name: 'Reading' }).click();

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

    await cleanup();
  });

  test('checks disconnection and reconnection when changing tab visibility', async ({
    page,
  }) => {
    await overrideConfig(page, {
      COLLABORATION_WS_INACTIVITY_TIMEOUT: 2, // 2 seconds for the test to be faster
    });

    await page.goto('/');

    let webSocketPromise = page.waitForEvent('websocket', (webSocket) => {
      return webSocket
        .url()
        .includes(`${process.env.COLLABORATION_WS_URL}?room=`);
    });

    await page
      .getByRole('button', {
        name: 'New doc',
      })
      .click();

    let webSocket = await webSocketPromise;
    expect(webSocket.url()).toContain(
      `${process.env.COLLABORATION_WS_URL}?room=`,
    );

    // Is connected
    let framesentPromise = webSocket.waitForEvent('framesent');

    await writeInEditor({ page, text: 'Hello World' });

    let framesent = await framesentPromise;
    expect(framesent.payload).not.toBeNull();

    // When the visibility is changed, the ws should close the connection
    const wsClosePromise = webSocket.waitForEvent('close');

    // Simulate the tab being hidden
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', {
        value: true,
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Assert the ws connection is closed after inactivity timeout
    const wsClose = await wsClosePromise;
    expect(wsClose.isClosed()).toBeTruthy();

    // Check the ws is connected again
    webSocketPromise = page.waitForEvent('websocket', (webSocket) => {
      return webSocket
        .url()
        .includes(`${process.env.COLLABORATION_WS_URL}?room=`);
    });

    // Simulate the tab becoming visible again
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', {
        value: false,
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    webSocket = await webSocketPromise;
    framesentPromise = webSocket.waitForEvent('framesent');
    framesent = await framesentPromise;
    // Assert the ws connection is working again
    expect(framesent.payload).not.toBeNull();
  });
});
