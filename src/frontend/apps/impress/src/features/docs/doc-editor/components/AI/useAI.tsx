import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createAIExtension } from '@blocknote/xl-ai';
import { useMemo } from 'react';

import { baseApiUrl, fetchAPI } from '@/api';
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

    const openai = createOpenAICompatible({
      name: 'AI Proxy',
      baseURL: `${baseApiUrl('1.0')}documents/${docId}/ai-proxy/`, // Necessary for initialization..
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

    const model = openai.chatModel(conf.AI_MODEL);

    const extension = createAIExtension({
      stream: conf.AI_STREAM,
      model,
      agentCursor: conf?.AI_BOT,
      promptBuilder,
    });

    return extension;
  }, [aiAllowed, conf, docId, promptBuilder]);
};
