import { Page } from '@playwright/test';

export const getEditor = async ({ page }: { page: Page }) => {
  const editor = page.locator('.ProseMirror');
  await editor.click();
  return editor;
};

export const openSuggestionMenu = async ({ page }: { page: Page }) => {
  const editor = await writeInEditor({ page, text: '/' });

  const suggestionMenu = page.locator('.bn-suggestion-menu');

  return { editor, suggestionMenu };
};

export const writeInEditor = async ({
  page,
  text,
}: {
  page: Page;
  text: string;
}) => {
  const editor = await getEditor({ page });
  await editor
    .locator('.bn-block-outer:last-child')
    .last()
    .locator('.bn-inline-content:last-child')
    .last()
    .fill(text);
  return editor;
};

export const mockAIResponse = async (page: Page) => {
  await page.route(/.*\/ai-proxy\//, async (route) => {
    const req = route.request();

    if (req.method() !== 'POST') {
      return route.continue();
    }

    const toolArgs = JSON.stringify({
      operations: [
        {
          type: 'update',
          id: 'initialBlockId$',
          block:
            '<p><span data-style-type="textColor" data-value="highlighttext" data-editable="" style="color: highlighttext;">Bonjour le monde</span></p>',
        },
      ],
    });

    const sse = [
      `data: ${JSON.stringify({
        id: 'chatcmpl-mock',
        object: 'chat.completion.chunk',
        created: 1770045982,
        model: 'openai/gpt-oss-120b',
        choices: [
          {
            index: 0,
            delta: { role: 'assistant' },
            finish_reason: null,
          },
        ],
      })}\n\n`,

      `data: ${JSON.stringify({
        id: 'chatcmpl-mock',
        object: 'chat.completion.chunk',
        created: 1770045982,
        model: 'openai/gpt-oss-120b',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: 'call_mock_0',
                  type: 'function',
                  function: {
                    name: 'applyDocumentOperations',
                    arguments: '',
                  },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      })}\n\n`,

      `data: ${JSON.stringify({
        id: 'chatcmpl-mock',
        object: 'chat.completion.chunk',
        created: 1770045982,
        model: 'openai/gpt-oss-120b',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index: 0,
                  function: {
                    arguments: toolArgs,
                  },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      })}\n\n`,

      `data: ${JSON.stringify({
        id: 'chatcmpl-mock',
        object: 'chat.completion.chunk',
        created: 1770045982,
        model: 'openai/gpt-oss-120b',
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: 'tool_calls',
          },
        ],
      })}\n\n`,

      `data: [DONE]\n\n`,
    ].join('');

    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
      body: sse,
    });
  });
};
