/* eslint-disable playwright/no-conditional-expect */
import { expect, test } from '@playwright/test';

import {
  createDoc,
  getCurrentConfig,
  mockedDocument,
  overrideConfig,
  verifyDocName,
} from './utils-common';
import {
  mockAIResponse,
  openSuggestionMenu,
  writeInEditor,
} from './utils-editor';

if (process.env.IS_INSTANCE !== 'true') {
  test.describe('Doc AI feature', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
    });

    [
      {
        AI_FEATURE_ENABLED: false,
        selector: 'Ask AI',
      },
      {
        AI_FEATURE_ENABLED: true,
        AI_FEATURE_BLOCKNOTE_ENABLED: false,
        selector: 'Ask AI',
      },
      {
        AI_FEATURE_ENABLED: true,
        AI_FEATURE_LEGACY_ENABLED: false,
        selector: 'AI',
      },
    ].forEach((config) => {
      test(`it checks the AI feature flag from config endpoint: ${JSON.stringify(config)}`, async ({
        page,
        browserName,
      }) => {
        await overrideConfig(page, config);

        await page.goto('/');

        await createDoc(page, 'doc-ai-feature', browserName, 1);

        await page.locator('.bn-block-outer').last().fill('Anything');
        await page.getByText('Anything').selectText();
        await expect(
          page.locator('button[data-test="convertMarkdown"]'),
        ).toHaveCount(1);
        await expect(
          page.getByRole('button', { name: config.selector, exact: true }),
        ).toBeHidden();
      });
    });

    test('it checks the AI feature and accepts changes', async ({
      page,
      browserName,
    }) => {
      await overrideConfig(page, {
        AI_BOT: {
          name: 'Albert AI',
          color: '#8bc6ff',
        },
        AI_FEATURE_ENABLED: true,
        AI_FEATURE_BLOCKNOTE_ENABLED: true,
      });

      await mockAIResponse(page);

      await page.goto('/');

      await createDoc(page, 'doc-ai', browserName, 1);

      await openSuggestionMenu({ page });
      await page.getByText('Ask AI').click();
      await expect(
        page.getByRole('option', { name: 'Continue Writing' }),
      ).toBeVisible();
      await expect(
        page.getByRole('option', { name: 'Summarize' }),
      ).toBeVisible();

      await page.keyboard.press('Escape');

      const editor = await writeInEditor({ page, text: 'Hello World' });
      await editor.getByText('Hello World').selectText();

      // Check from toolbar
      await page.getByRole('button', { name: 'Ask AI' }).click();

      await expect(
        page.getByRole('option', { name: 'Improve Writing' }),
      ).toBeVisible();
      await expect(
        page.getByRole('option', { name: 'Fix Spelling' }),
      ).toBeVisible();
      await expect(
        page.getByRole('option', { name: 'Translate' }),
      ).toBeVisible();

      await page.getByRole('option', { name: 'Translate' }).click();
      await page
        .getByRole('textbox', { name: 'Ask anything...' })
        .fill('Translate into french');
      await page
        .getByRole('textbox', { name: 'Ask anything...' })
        .press('Enter');
      await expect(editor.getByText('Albert AI')).toBeVisible();
      await page
        .locator('p.bn-mt-suggestion-menu-item-title')
        .getByText('Accept')
        .click();

      await expect(editor.getByText('Bonjour le monde')).toBeVisible();

      // Check Suggestion menu
      await openSuggestionMenu({
        page,
      });
      await expect(page.getByText('Write with AI')).toBeVisible();

      // Reload the page to check that the AI change is still there
      await page.goto(page.url());
      await expect(editor.getByText('Bonjour le monde')).toBeVisible();
    });

    test('it reverts with the AI feature', async ({ page, browserName }) => {
      await overrideConfig(page, {
        AI_BOT: {
          name: 'Albert AI',
          color: '#8bc6ff',
        },
        AI_FEATURE_ENABLED: true,
        AI_FEATURE_BLOCKNOTE_ENABLED: true,
      });

      await mockAIResponse(page);

      await page.goto('/');

      await createDoc(page, 'doc-ai', browserName, 1);

      const editor = await writeInEditor({ page, text: 'Hello World' });
      await editor.getByText('Hello World').selectText();

      // Check from toolbar
      await page.getByRole('button', { name: 'Ask AI' }).click();

      await page.getByRole('option', { name: 'Translate' }).click();
      await page
        .getByRole('textbox', { name: 'Ask anything...' })
        .fill('Translate into french');
      await page
        .getByRole('textbox', { name: 'Ask anything...' })
        .press('Enter');
      await expect(editor.getByText('Albert AI')).toBeVisible();
      await expect(editor.getByText('Bonjour le monde')).toBeVisible();
      await page
        .locator('p.bn-mt-suggestion-menu-item-title')
        .getByText('Revert')
        .click();

      await expect(editor.getByText('Hello World')).toBeVisible();
    });

    test('it checks the AI buttons feature legacy', async ({
      page,
      browserName,
    }) => {
      await overrideConfig(page, {
        AI_FEATURE_ENABLED: true,
        AI_FEATURE_LEGACY_ENABLED: true,
      });

      await page.route(/.*\/ai-translate\//, async (route) => {
        const request = route.request();
        if (request.method().includes('POST')) {
          await route.fulfill({
            json: {
              answer: 'Hallo Welt',
            },
          });
        } else {
          await route.continue();
        }
      });

      await createDoc(page, 'doc-ai', browserName, 1);

      await page.locator('.bn-block-outer').last().fill('Hello World');

      const editor = page.locator('.ProseMirror');
      await editor.getByText('Hello').selectText();

      await page.getByRole('button', { name: 'AI', exact: true }).click();

      await expect(
        page.getByRole('menuitem', { name: 'Use as prompt' }),
      ).toBeVisible();
      await expect(
        page.getByRole('menuitem', { name: 'Rephrase' }),
      ).toBeVisible();
      await expect(
        page.getByRole('menuitem', { name: 'Summarize' }),
      ).toBeVisible();
      await expect(
        page.getByRole('menuitem', { name: 'Correct' }),
      ).toBeVisible();
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

      await page.getByRole('menuitem', { name: 'German', exact: true }).click();

      await expect(editor.getByText('Hallo Welt')).toBeVisible();
    });

    [
      { ai_transform: false, ai_translate: false },
      { ai_transform: true, ai_translate: false },
      { ai_transform: false, ai_translate: true },
    ].forEach(({ ai_transform, ai_translate }) => {
      test(`it checks AI buttons when can transform is at "${ai_transform}" and can translate is at "${ai_translate}"`, async ({
        page,
        browserName,
      }) => {
        await overrideConfig(page, {
          AI_FEATURE_ENABLED: true,
          AI_FEATURE_LEGACY_ENABLED: true,
        });

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
            ai_transform,
            ai_translate,
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
          'doc-editor-ai',
          browserName,
          1,
        );

        await verifyDocName(page, randomDoc);

        await page.locator('.bn-block-outer').last().fill('Hello World');

        const editor = page.locator('.ProseMirror');
        await editor.getByText('Hello').selectText();

        if (!ai_transform && !ai_translate) {
          await expect(
            page.getByRole('button', { name: 'AI', exact: true }),
          ).toBeHidden();
          return;
        }

        await page.getByRole('button', { name: 'AI', exact: true }).click();

        if (ai_transform) {
          await expect(
            page.getByRole('menuitem', { name: 'Use as prompt' }),
          ).toBeVisible();
        } else {
          await expect(
            page.getByRole('menuitem', { name: 'Use as prompt' }),
          ).toBeHidden();
        }

        if (ai_translate) {
          await expect(
            page.getByRole('menuitem', { name: 'Language' }),
          ).toBeVisible();
        } else {
          await expect(
            page.getByRole('menuitem', { name: 'Language' }),
          ).toBeHidden();
        }
      });
    });

    test(`it checks ai_proxy ability`, async ({ page, browserName }) => {
      await overrideConfig(page, {
        AI_FEATURE_ENABLED: true,
        AI_FEATURE_LEGACY_ENABLED: true,
      });

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
      await openSuggestionMenu({
        page,
      });
      await expect(page.getByText('Write with AI')).toBeHidden();
    });
  });
}

if (process.env.IS_INSTANCE === 'true') {
  test.describe('Doc AI feature on Instance', () => {
    test('it checks legacy AI feature', async ({ page, browserName }) => {
      const currentConfig = await getCurrentConfig(page);
      test.skip(
        !currentConfig.AI_FEATURE_ENABLED ||
          !currentConfig.AI_FEATURE_LEGACY_ENABLED,
        'Legacy AI feature is not enabled',
      );

      await createDoc(page, 'doc-editor-ai-legacy-instance', browserName, 1);

      const editor = await writeInEditor({ page, text: 'Hello World' });

      await page.waitForTimeout(1000);

      await editor.getByText('Hello World').selectText();

      await page.getByRole('button', { name: 'AI', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Language' }).hover();
      await page.getByRole('menuitem', { name: 'French', exact: true }).click();

      await expect(editor.getByText('Bonjour le monde')).toBeVisible();
    });

    test('it checks legacy AI Blocknote', async ({ page, browserName }) => {
      const currentConfig = await getCurrentConfig(page);
      test.skip(
        !currentConfig.AI_FEATURE_ENABLED ||
          !currentConfig.AI_FEATURE_BLOCKNOTE_ENABLED,
        'Blocknote AI feature is not enabled',
      );

      /**
       * Problem with the POSTHOG flags that keep false.
       * In case the flag is present, we mock the response
       */
      await page.route(/flags\/\?v=2/, async (route) => {
        const request = route.request();
        if (request.method().includes('POST')) {
          await route.fulfill({
            json: {
              errorsWhileComputingFlags: false,
              flags: {
                ai_blocknote: {
                  key: 'ai_blocknote',
                  enabled: true,
                  variant: null,
                  reason: {
                    code: 'condition_match',
                    condition_index: 5,
                    description: 'Matched condition set 6',
                  },
                  metadata: {
                    id: 147864,
                    version: 47,
                    description: null,
                    payload: null,
                  },
                },
              },
              requestId: '2e3dc8be-d43c-4c9b-b497-c566f342904b',
              evaluatedAt: 1775060096052,
            },
          });
        } else {
          await route.continue();
        }
      });

      await createDoc(page, 'doc-editor-ai-BN-instance', browserName, 1);

      const editor = await writeInEditor({ page, text: 'Hello World' });

      await page.waitForTimeout(1000);

      await editor.getByText('Hello World').selectText();

      await page.getByRole('button', { name: 'Ask AI' }).click();
      await page.getByRole('option', { name: 'Translate' }).click();
      await page
        .getByRole('textbox', { name: 'Ask anything...' })
        .fill('Translate into french');
      await page
        .getByRole('textbox', { name: 'Ask anything...' })
        .press('Enter');

      await expect(editor.getByText(currentConfig.AI_BOT.name)).toBeVisible();
      await expect(editor.getByText('Bonjour le monde')).toBeVisible();
      await page
        .locator('p.bn-mt-suggestion-menu-item-title')
        .getByText('Revert')
        .click();

      await expect(editor.getByText('Hello World')).toBeVisible();
    });
  });
}
