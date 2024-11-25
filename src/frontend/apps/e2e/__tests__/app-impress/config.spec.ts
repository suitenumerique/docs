import path from 'path';

import { expect, test } from '@playwright/test';

import { createDoc, verifyDocName } from './common';

const config = {
  CRISP_WEBSITE_ID: null,
  COLLABORATION_WS_URL: 'ws://localhost:8083/collaboration/ws/',
  ENVIRONMENT: 'development',
  FRONTEND_THEME: 'dsfr',
  MEDIA_BASE_URL: 'http://localhost:8083',
  LANGUAGES: [
    ['en-us', 'English'],
    ['fr-fr', 'French'],
    ['de-de', 'German'],
  ],
  LANGUAGE_CODE: 'en-us',
  SENTRY_DSN: null,
};

test.describe('Config', () => {
  test('it checks the config api is called', async ({ page }) => {
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/config/') && response.status() === 200,
    );

    await page.goto('/');

    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();

    expect(await response.json()).toStrictEqual(config);
  });

  test('it checks that sentry is trying to init from config endpoint', async ({
    page,
  }) => {
    await page.route('**/api/v1.0/config/', async (route) => {
      const request = route.request();
      if (request.method().includes('GET')) {
        await route.fulfill({
          json: {
            ...config,
            SENTRY_DSN: 'https://sentry.io/123',
          },
        });
      } else {
        await route.continue();
      }
    });

    const invalidMsg = 'Invalid Sentry Dsn: https://sentry.io/123';
    const consoleMessage = page.waitForEvent('console', {
      timeout: 5000,
      predicate: (msg) => msg.text().includes(invalidMsg),
    });

    await page.goto('/');

    expect((await consoleMessage).text()).toContain(invalidMsg);
  });

  test('it checks that theme is configured from config endpoint', async ({
    page,
  }) => {
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/config/') && response.status() === 200,
    );

    await page.goto('/');

    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();

    const jsonResponse = await response.json();
    expect(jsonResponse.FRONTEND_THEME).toStrictEqual('dsfr');

    const footer = page.locator('footer').first();
    // alt 'Gouvernement Logo' comes from the theme
    await expect(footer.getByAltText('Gouvernement Logo')).toBeVisible();
  });

  test('it checks that media server is configured from config endpoint', async ({
    page,
    browserName,
  }) => {
    await page.goto('/');

    await createDoc(page, 'doc-media', browserName, 1);

    const fileChooserPromise = page.waitForEvent('filechooser');

    await page.locator('.bn-block-outer').last().fill('Anything');
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

  test('it checks that collaboration server is configured from config endpoint', async ({
    page,
    browserName,
  }) => {
    const webSocketPromise = page.waitForEvent('websocket', (webSocket) => {
      return webSocket.url().includes('ws://localhost:8083/collaboration/ws/');
    });

    await page.goto('/');

    const randomDoc = await createDoc(
      page,
      'doc-collaboration',
      browserName,
      1,
    );

    await verifyDocName(page, randomDoc[0]);

    const webSocket = await webSocketPromise;
    expect(webSocket.url()).toContain('ws://localhost:8083/collaboration/ws/');
  });

  test('it checks that Crisp is trying to init from config endpoint', async ({
    page,
  }) => {
    await page.route('**/api/v1.0/config/', async (route) => {
      const request = route.request();
      if (request.method().includes('GET')) {
        await route.fulfill({
          json: {
            ...config,
            CRISP_WEBSITE_ID: '1234',
          },
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');

    await expect(
      page.locator('#crisp-chatbox').getByText('Invalid website'),
    ).toBeVisible();
  });
});
