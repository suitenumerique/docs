/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
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

    // Extract the block ID from the request's selectedBlocks
    const requestData = req.postDataJSON();
    const messages = requestData?.messages || [];
    const userMessage = messages.find((msg: any) => msg.role === 'user');
    const documentState = userMessage?.metadata?.documentState;
    const selectedBlocks = documentState?.selectedBlocks || [];
    const blockId = selectedBlocks[0]?.id || 'initialBlockId$';

    const sse = [
      `data: {"type":"start"}\n\n`,
      `data: {"type":"start-step"}\n\n`,
      `data: ${JSON.stringify({
        type: 'tool-input-available',
        toolCallId: 'chatcmpl-mock-0',
        toolName: 'applyDocumentOperations',
        input: {
          operations: [
            {
              type: 'update',
              id: blockId,
              block: '<p>Bonjour le monde</p>',
            },
          ],
        },
      })}\n\n`,
      `data: {"type":"finish-step"}\n\n`,
      `data: {"type":"finish","finishReason":"tool-calls"}\n\n`,
      `data: [DONE]\n\n`,
    ].join('');

    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'x-vercel-ai-data-stream': 'v1',
        'x-accel-buffering': 'no',
        Connection: 'keep-alive',
      },
      body: sse,
    });
  });
};
