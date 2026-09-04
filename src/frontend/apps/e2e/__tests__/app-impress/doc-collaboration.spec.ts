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
  });

  /**
   * A change to the sharing settings has to reach the clients that are already connected.
   * The backend asks the collaboration server to re-check them, and yhub closes the sockets
   * whose access is no longer the one they connected with - code 4401 - and leaves the
   * others open. The client then reconnects and resyncs at its new level.
   *
   * The author is not the one to watch: their access is the same before and after, and their
   * socket is deliberately kept. This is the difference with what the collaboration server
   * used to do, which was to close every connection to the document indiscriminately. What
   * moves here is the anonymous reader holding the public link, whose access goes from read
   * to read/write when the link is switched to Editing.
   */
  test('closes the connection of a user whose access changed', async ({
    page,
    browserName,
  }) => {
    const [docTitle] = await createDoc(
      page,
      'doc-reset-connections',
      browserName,
      1,
    );
    await verifyDocName(page, docTitle);

    await page.getByRole('button', { name: 'Share' }).click();
    await updateShareLink(page, 'Public', 'Reading');
    await page.getByRole('button', { name: 'close' }).first().click();

    const { otherPage, cleanup } = await connectOtherUserToDoc({
      browserName,
      docUrl: page.url(),
      withoutSignIn: true,
      docTitle,
    });

    // the reader is on the document, at the level the link grants today
    await expect(otherPage.locator('.ProseMirror')).toHaveAttribute(
      'contenteditable',
      'false',
    );

    // The socket the reader holds was opened by `connectOtherUserToDoc`, before this test had
    // a page to listen on, so it is unreachable. Reloading opens another one under a listener.
    const readerSocketPromise = otherPage.waitForEvent(
      'websocket',
      (webSocket) =>
        webSocket.url().includes(`${process.env.COLLABORATION_WS_URL}/`),
    );
    await otherPage.reload();
    const readerSocket = await readerSocketPromise;
    await readerSocket.waitForEvent('framesent');

    const readerSocketClosed = readerSocket.waitForEvent('close');
    const readerReconnected = otherPage.waitForEvent('websocket', (webSocket) =>
      webSocket.url().includes(`${process.env.COLLABORATION_WS_URL}/`),
    );

    // the author opens the link to editing
    await page.getByRole('button', { name: 'Share' }).click();
    await page.getByTestId('doc-access-mode').click();
    await page.getByRole('menuitemradio', { name: 'Editing' }).click();
    await expect(
      page.getByText('The document visibility has been updated').first(),
    ).toBeVisible();

    // the re-check reaches the reader and their socket goes down
    await readerSocketClosed;
    expect(readerSocket.isClosed()).toBeTruthy();

    // and the client comes back on its own. What proves the new connection is live is not the
    // socket being open - a socket that is refused is open for a moment too - but the document
    // still flowing through it: nothing is reloaded here, so the only way the text below can
    // reach the reader is the connection opened after the revocation.
    await readerReconnected;

    await page.getByRole('button', { name: 'close' }).first().click();
    await writeInEditor({ page, text: 'Hello after the reset' });

    await expect(otherPage.getByText('Hello after the reset')).toBeVisible({
      timeout: 15000,
    });

    await cleanup();
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

  /**
   * The networks that refuse a websocket upgrade - corporate proxies, captive portals.
   * `routeWebSocket` never forwards the connection to the server and closes it towards the
   * page, which is what those look like from the browser: a socket that dies immediately,
   * every time. The editor has to keep working over y/hub's REST api instead.
   */
  test('falls back to http polling when the websocket cannot be opened', async ({
    page,
  }) => {
    // Polling is slower than a socket by construction, and this waits on it three times: the
    // first retrieval, the publication about a second after the last keystroke, and the
    // retrieval after the reload. The default 30s budget cannot cover that.
    test.setTimeout(120000);

    await page.routeWebSocket(/\/collaboration\/ws\//, (ws) => ws.close());
    // the interception is injected when a document is created, so it only covers sockets
    // opened after a navigation - `beforeEach` has already loaded this one
    await page.goto('/');

    const retrieved = page.waitForResponse(
      (response) =>
        response.url().includes('/collaboration/ydoc/v1/') &&
        response.request().method() === 'GET',
      { timeout: 45000 },
    );

    await page
      .getByRole('link', {
        name: 'New',
        exact: true,
      })
      .click();

    // a 401/403 here means the request is authorized differently than the websocket:
    // the session cookie did not reach the collaboration server, or the origin was refused
    expect((await retrieved).status()).toBe(200);

    // The one carrying the text, not merely the next one: awareness is published over the same
    // route, so waiting for any PATCH would let the reload below race the document update, which
    // is debounced until about a second after the last keystroke. Yjs stores inserted text as
    // plain utf-8 in the update, so the body says whether this is the request we are waiting for.
    const published = page.waitForRequest(
      (request) =>
        request.url().includes('/collaboration/ydoc/v1/') &&
        request.method() === 'PATCH' &&
        (request.postDataBuffer()?.includes('Hello over http') ?? false),
      { timeout: 45000 },
    );

    await writeInEditor({ page, text: 'Hello over http' });

    expect((await (await published).response())?.status()).toBe(200);

    // the round trip: the socket is still refused, so what comes back on reload came back
    // over http
    await page.reload();

    await expect(page.getByText('Hello over http')).toBeVisible({
      timeout: 45000,
    });
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
