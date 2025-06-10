import { createOpenAI } from '@ai-sdk/openai';
import { createAIExtension, llmFormats } from '@blocknote/xl-ai';
import { useMemo } from 'react';

import { fetchAPI } from '@/api';
import { useConfig } from '@/core';
import { Doc } from '@/docs/doc-management';

import { usePromptAI } from './usePromptAI';

export const useAI = (docId: Doc['id'], aiAllowed: boolean) => {
  const conf = useConfig().data;
  const promptBuilder = usePromptAI();

  return useMemo(() => {
    if (!aiAllowed || !conf?.AI_MODEL) {
      return;
    }

    const openai = createOpenAI({
      apiKey: '', // The API key will be set by the AI proxy
      fetch: (input, init) => {
        // Create a new headers object without the Authorization header
        const headers = new Headers(init?.headers);
        headers.delete('Authorization');

        return fetchAPI(`documents/${docId}/ai-proxy/`, {
          ...init,
          headers,
        });
      },
    });
    const model = openai.chat(conf.AI_MODEL);

    const extension = createAIExtension({
      stream: false,
      model,
      agentCursor: conf?.AI_BOT,
      promptBuilder: promptBuilder(llmFormats.html.defaultPromptBuilder),
    });

    return extension;
  }, [aiAllowed, conf, docId, promptBuilder]);
};
