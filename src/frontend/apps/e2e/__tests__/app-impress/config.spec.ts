import path from 'path';

import { expect, test } from '@playwright/test';

import { CONFIG, createDoc, overrideConfig } from './utils-common';

test.describe('Config', () => {
  test('it checks that sentry is trying to init from config endpoint', async ({
    page,
  }) => {
    await overrideConfig(page, {
      SENTRY_DSN: 'https://sentry.io/123',
    });

    const invalidMsg = 'Invalid Sentry Dsn: https://sentry.io/123';
    const consoleMessage = page.waitForEvent('console', {
      timeout: 5000,
      predicate: (msg) => msg.text().includes(invalidMsg),
    });

    await page.goto('/');

    expect((await consoleMessage).text()).toContain(invalidMsg);
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

    // Wait for the media-check to be processed
    // eslint-disable-next-line playwright/no-wait-for-timeout
    await page.waitForTimeout(1000);

    // Check src of image
    expect(await image.getAttribute('src')).toMatch(
      /http:\/\/localhost:8083\/media\/.*\/attachments\/.*.png/,
    );
  });

  test('it checks that collaboration server is configured from config endpoint', async ({
    page,
  }) => {
    await page.goto('/');

    void page
      .getByRole('button', {
        name: 'New doc',
      })
      .click();

    const webSocket = await page.waitForEvent('websocket', (webSocket) => {
      return webSocket.url().includes('ws://localhost:4444/collaboration/ws/');
    });
    expect(webSocket.url()).toContain('ws://localhost:4444/collaboration/ws/');
  });

  test('it checks the AI feature flag from config endpoint', async ({
    page,
    browserName,
  }) => {
    await overrideConfig(page, {
      AI_FEATURE_ENABLED: false,
    });

    await page.goto('/');

    await createDoc(page, 'doc-ai-feature', browserName, 1);

    await page.locator('.bn-block-outer').last().fill('Anything');
    await page.getByText('Anything').selectText();
    expect(
      await page.locator('button[data-test="convertMarkdown"]').count(),
    ).toBe(1);
    expect(await page.locator('button[data-test="ai-actions"]').count()).toBe(
      0,
    );
  });

  test('it checks that Crisp is trying to init from config endpoint', async ({
    page,
  }) => {
    await overrideConfig(page, {
      CRISP_WEBSITE_ID: '1234',
    });

    await page.goto('/');

    await expect(
      page.locator('#crisp-chatbox').getByText('Invalid website'),
    ).toBeVisible();
  });

  test('it checks FRONTEND_CSS_URL config', async ({ page }) => {
    await overrideConfig(page, {
      FRONTEND_CSS_URL: 'http://localhost:123465/css/style.css',
    });

    await page.goto('/');

    await expect(
      page
        .locator('head link[href="http://localhost:123465/css/style.css"]')
        .first(),
    ).toBeAttached();
  });

  test('it checks theme_customization.translations config', async ({
    page,
  }) => {
    await overrideConfig(page, {
      theme_customization: {
        translations: {
          en: {
            translation: {
              Docs: 'MyCustomDocs',
            },
          },
        },
      },
    });

    await page.goto('/');

    await expect(page.getByText('MyCustomDocs')).toBeAttached();
  });
});

test.describe('Config: Not logged', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('it checks the config api is called', async ({ page }) => {
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/config/') && response.status() === 200,
    );

    await page.goto('/');

    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();

    const json = (await response.json()) as typeof CONFIG;
    const { theme_customization, ...configApi } = json;
    expect(theme_customization).toBeDefined();
    const { theme_customization: _, ...CONFIG_LEFT } = CONFIG;

    expect(configApi).toStrictEqual(CONFIG_LEFT);
  });

  test('it checks that theme is configured from config endpoint', async ({
    page,
  }) => {
    await overrideConfig(page, {
      FRONTEND_THEME: 'dsfr',
    });

    await page.goto('/');

    const header = page.locator('header').first();
    // alt 'Gouvernement Logo' comes from the theme
    await expect(header.getByAltText('Gouvernement Logo')).toBeVisible();
  });
});
