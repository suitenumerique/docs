import path from 'path';

import { expect, test } from '@playwright/test';

import { createDoc, overrideConfig, verifyDocName } from './utils-common';
import { openSuggestionMenu, writeInEditor } from './utils-editor';
import { connectOtherUserToDoc, updateShareLink } from './utils-share';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('Doc Collaboration', () => {
  /**
   * We check:
   *  - connection to the collaborative server
   */
  test('checks the connection with collaborative server', async ({ page }) => {
    const webSocketPromise = page.waitForEvent('websocket', (webSocket) => {
      return webSocket.url().includes(`${process.env.COLLABORATION_WS_URL}/`);
    });

    await page
      .getByRole('link', {
        name: 'New',
        exact: true,
      })
      .click();

    const webSocket = await webSocketPromise;
    expect(webSocket.url()).toContain(`${process.env.COLLABORATION_WS_URL}/`);

    // Is connected
    const framesentPromise = webSocket.waitForEvent('framesent');

    await writeInEditor({ page, text: 'Hello World' });

    const framesent = await framesentPromise;
    expect(framesent.payload).not.toBeNull();

    // TODO(yhub): re-add the close/reconnect check (the backend closed the
    // connection when the doc visibility changed) once yhub exposes a kick
    // API - `reset_connections` is currently a no-op so the server never
    // closes the connection.
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

  // TODO(yhub): Add test to check that no connected websocket users can collaborate

  test('checks disconnection and reconnection when changing tab visibility', async ({
    page,
  }) => {
    await overrideConfig(page, {
      COLLABORATION_WS_INACTIVITY_TIMEOUT: 2, // 2 seconds for the test to be faster
    });

    await page.goto('/');

    let webSocketPromise = page.waitForEvent('websocket', (webSocket) => {
      return webSocket.url().includes(`${process.env.COLLABORATION_WS_URL}/`);
    });

    await page
      .getByRole('link', {
        name: 'New',
        exact: true,
      })
      .click();

    let webSocket = await webSocketPromise;
    expect(webSocket.url()).toContain(`${process.env.COLLABORATION_WS_URL}/`);

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
      return webSocket.url().includes(`${process.env.COLLABORATION_WS_URL}/`);
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
