import path from 'path';

import { expect, test } from '@playwright/test';
import cs from 'convert-stream';

import {
  CONFIG,
  addNewMember,
  createDoc,
  goToGridDoc,
  mockedDocument,
  overrideConfig,
  verifyDocName,
} from './common';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('Doc Editor', () => {
  test('it checks default toolbar buttons are displayed', async ({
    page,
    browserName,
  }) => {
    await createDoc(page, 'doc-toolbar', browserName, 1);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await editor.fill('test content');

    await editor
      .getByText('test content', {
        exact: true,
      })
      .selectText();

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

    await page.locator('.ProseMirror.bn-editor').click();
    await page.locator('.ProseMirror.bn-editor').fill('Hello World');

    let framesent = await framesentPromise;
    expect(framesent.payload).not.toBeNull();

    await page.getByRole('button', { name: 'Share' }).click();

    const selectVisibility = page.getByLabel('Visibility', { exact: true });

    // When the visibility is changed, the ws should close the connection (backend signal)
    const wsClosePromise = webSocket.waitForEvent('close');

    await selectVisibility.click();
    await page.getByLabel('Connected').click();

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
    // eslint-disable-next-line playwright/no-skipped-test
    test.skip(browserName === 'webkit', 'This test is very flaky with webkit');

    // Check the first doc
    const [doc] = await createDoc(page, 'doc-quit-1', browserName, 1);
    await verifyDocName(page, doc);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await editor.fill('Hello World Doc persisted 2');
    await expect(editor.getByText('Hello World Doc persisted 2')).toBeVisible();

    const urlDoc = page.url();
    await page.goto(urlDoc);

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

  test('it checks the AI feature', async ({ page, browserName }) => {
    await overrideConfig(page, {
      AI_BOT: {
        name: 'Albert AI',
        color: '#8bc6ff',
      },
    });

    await page.goto('/');

    await page.route(/.*\/ai-proxy\//, async (route) => {
      const request = route.request();
      if (request.method().includes('POST')) {
        await route.fulfill({
          json: {
            id: 'chatcmpl-b1e7a9e456ca41f78fec130d552a6bf5',
            choices: [
              {
                finish_reason: 'stop',
                index: 0,
                logprobs: null,
                message: {
                  content: '',
                  refusal: null,
                  role: 'assistant',
                  annotations: null,
                  audio: null,
                  function_call: null,
                  tool_calls: [
                    {
                      id: 'chatcmpl-tool-2e3567dfecf94a4c85e27a3528337718',
                      function: {
                        arguments:
                          '{"operations": [{"type": "update", "id": "initialBlockId$", "block": "<p>Bonjour le monde</p>"}]}',
                        name: 'json',
                      },
                      type: 'function',
                    },
                  ],
                  reasoning_content: null,
                },
                stop_reason: null,
              },
            ],
            created: 1749549477,
            model: 'neuralmagic/Meta-Llama-3.1-70B-Instruct-FP8',
            object: 'chat.completion',
            service_tier: null,
            system_fingerprint: null,
            usage: {
              completion_tokens: 0,
              prompt_tokens: 204,
              total_tokens: 204,
              completion_tokens_details: null,
              prompt_tokens_details: null,
              details: [
                {
                  id: 'chatcmpl-b1e7a9e456ca41f78fec130d552a6bf5',
                  model: 'neuralmagic/Meta-Llama-3.1-70B-Instruct-FP8',
                  prompt_tokens: 204,
                  completion_tokens: 0,
                  total_tokens: 204,
                },
              ],
            },
            prompt_logprobs: null,
          },
        });
      } else {
        await route.continue();
      }
    });

    await createDoc(page, 'doc-ai', browserName, 1);

    await page.locator('.bn-block-outer').last().fill('Hello World');

    const editor = page.locator('.ProseMirror');
    await editor.getByText('Hello World').selectText();

    // Check from toolbar
    await page.getByRole('button', { name: 'Ask AI' }).click();

    await expect(
      page.getByRole('option', { name: 'Improve Writing' }),
    ).toBeVisible();
    await expect(
      page.getByRole('option', { name: 'Fix Spelling' }),
    ).toBeVisible();
    await expect(page.getByRole('option', { name: 'Translate' })).toBeVisible();

    await page.getByRole('option', { name: 'Translate' }).click();
    await page.getByPlaceholder('Ask AI anything…').fill('French');
    await page.getByPlaceholder('Ask AI anything…').press('Enter');
    await expect(editor.getByText('Albert AI')).toBeVisible();
    await page
      .locator('p.bn-mt-suggestion-menu-item-title')
      .getByText('Accept')
      .click();

    await expect(editor.getByText('Bonjour le monde')).toBeVisible();

    // Check Suggestion menu
    await page.locator('.bn-block-outer').last().fill('/');
    await expect(page.getByText('Write with AI')).toBeVisible();
  });

  test(`it checks ai_proxy ability`, async ({ page, browserName }) => {
    await mockedDocument(page, {
      accesses: [
        {
          id: 'b0df4343-c8bd-4c20-9ff6-fbf94fc94egg',
          role: 'owner',
          user: {
            email: 'super@owner.com',
            full_name: 'Super Owner',
          },
        },
      ],
      abilities: {
        destroy: true, // Means owner
        link_configuration: true,
        ai_proxy: false,
        accesses_manage: true,
        accesses_view: true,
        update: true,
        partial_update: true,
        retrieve: true,
      },
      link_reach: 'restricted',
      link_role: 'editor',
      created_at: '2021-09-01T09:00:00Z',
      title: '',
    });

    const [randomDoc] = await createDoc(
      page,
      'doc-editor-ai-proxy',
      browserName,
      1,
    );

    await verifyDocName(page, randomDoc);

    await page.locator('.bn-block-outer').last().fill('Hello World');

    const editor = page.locator('.ProseMirror');
    await editor.getByText('Hello').selectText();

    await expect(page.getByRole('button', { name: 'Ask AI' })).toBeHidden();
    await page.locator('.bn-block-outer').last().fill('/');
    await expect(page.getByText('Write with AI')).toBeHidden();
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

    await page.getByRole('button', { name: 'Download' }).click();

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
              status: requestCount ? 'ready' : 'processing',
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

    const editor = page.locator('.ProseMirror.bn-editor');

    await editor.click();
    await editor.locator('.bn-block-outer').last().fill('/');
    await page.getByText('Embedded file').click();
    await page.getByText('Upload file').click();

    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(__dirname, 'assets/test.html'));

    await expect(editor.getByText('Analyzing file...')).toBeVisible();
    // The retry takes a few seconds
    await expect(editor.getByText('test.html')).toBeVisible({
      timeout: 7000,
    });
    await expect(editor.getByText('Analyzing file...')).toBeHidden();
  });

  test('it checks block editing when not connected to collab server', async ({
    page,
  }) => {
    await page.route('**/api/v1.0/config/', async (route) => {
      const request = route.request();
      if (request.method().includes('GET')) {
        await route.fulfill({
          json: {
            ...CONFIG,
            COLLABORATION_WS_URL: 'ws://localhost:5555/collaboration/ws/',
            COLLABORATION_WS_NOT_CONNECTED_READY_ONLY: true,
          },
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');

    void page
      .getByRole('button', {
        name: 'New doc',
      })
      .click();

    const card = page.getByLabel('It is the card information');
    await expect(
      card.getByText('Your network do not allow you to edit'),
    ).toBeHidden();
    const editor = page.locator('.ProseMirror');

    await expect(editor).toHaveAttribute('contenteditable', 'true');

    await page.getByRole('button', { name: 'Share' }).click();

    await addNewMember(page, 0, 'Editor', 'impress');

    // Close the modal
    await page.getByRole('button', { name: 'close' }).first().click();

    await expect(
      card.getByText('Your network do not allow you to edit'),
    ).toBeVisible({
      timeout: 10000,
    });

    await expect(editor).toHaveAttribute('contenteditable', 'false');
  });

  test('it checks if callout custom block', async ({ page, browserName }) => {
    await createDoc(page, 'doc-toolbar', browserName, 1);

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.locator('.bn-block-outer').last().fill('/');
    await page.getByText('Add a callout block').click();

    const calloutBlock = page
      .locator('div[data-content-type="callout"]')
      .first();

    await expect(calloutBlock).toBeVisible();

    await calloutBlock.locator('.inline-content').fill('example text');

    await expect(page.locator('.bn-block').first()).toHaveAttribute(
      'data-background-color',
      'yellow',
    );

    const emojiButton = calloutBlock.getByRole('button');
    await expect(emojiButton).toHaveText('💡');
    await emojiButton.click();
    await page.locator('button[aria-label="⚠️"]').click();
    await expect(emojiButton).toHaveText('⚠️');

    await page.locator('.bn-side-menu > button').last().click();
    await page.locator('.mantine-Menu-dropdown > button').last().click();
    await page.locator('.bn-color-picker-dropdown > button').last().click();

    await expect(page.locator('.bn-block').first()).toHaveAttribute(
      'data-background-color',
      'pink',
    );
  });
});
