import { Browser, expect, firefox, test } from '@playwright/test';

import { createDoc } from './common';

let firefoxBrowser: Browser;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  firefoxBrowser = await firefox.launch({ headless: false });
});
test.afterEach(async () => {
  await firefoxBrowser?.close();
});

test.describe('Doc Collaboration', () => {
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
    await expect(page.locator('h2').getByText(randomDoc[0])).toBeVisible();

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

  test('checks the connection switch to polling after websocket failure', async ({
    page,
    browserName,
  }) => {
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/poll/') && response.status() === 200,
    );

    await page.routeWebSocket(
      'ws://localhost:8083/collaboration/ws/**',
      async (ws) => {
        await ws.close();
      },
    );

    await page.reload();

    const randomDoc = await createDoc(page, 'doc-polling', browserName, 1);
    await expect(page.locator('h2').getByText(randomDoc[0])).toBeVisible();

    const response = await responsePromise;
    const responseJson = (await response.json()) as {
      connectionsCount: number;
      yDoc64?: string;
    };

    expect(responseJson.yDoc64).toBeDefined();
    expect(responseJson.connectionsCount).toBe(0);
  });

  test('checks the collaboration between 2 browsers', async ({
    page,
    browserName,
  }) => {
    // eslint-disable-next-line playwright/no-skipped-test
    test.skip(browserName === 'webkit' || browserName === 'firefox');

    const [randomDoc] = await createDoc(
      page,
      'doc-collaboration',
      browserName,
      1,
    );
    await expect(
      page.getByLabel('doc title input').getByText(randomDoc),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Share' }).click();
    await page.getByLabel('Visibility', { exact: true }).click();
    await page.getByRole('button', { name: 'Public' }).click();
    await page.getByLabel('Visibility mode').click();
    await page.getByRole('button', { name: 'Edition' }).click();
    await page.getByRole('button', { name: 'close' }).click();

    const chromeEditor = page.locator('.ProseMirror');
    await chromeEditor.click();
    await chromeEditor.fill('Hello Firefox');

    const urlDoc = page.url();

    const firefoxContext = await firefoxBrowser.newContext({
      locale: 'en-US',
      timezoneId: 'Europe/Paris',
      permissions: [],
    });
    const firefoxPage = await firefoxContext.newPage();
    await firefoxPage.goto(urlDoc);
    const firefoxEditor = firefoxPage.locator('.ProseMirror');

    // The cursor tag of the collaborator should be visible
    await expect(firefoxEditor.getByText('E2E Chromium')).toBeVisible();
    await expect(firefoxEditor.getByText('Hello Firefox')).toBeVisible();

    await firefoxEditor.locator('.bn-block-outer').last().fill('Hello Chrome');

    await expect(chromeEditor.getByText('Hello Chrome')).toBeVisible();

    // await firefoxPage.close();
    // await firefoxContext.close();
    // await firefoxBrowser.close();
  });
});
