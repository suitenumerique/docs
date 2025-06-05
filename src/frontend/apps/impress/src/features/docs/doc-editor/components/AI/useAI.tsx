import { createOpenAI } from '@ai-sdk/openai';
import { createAIExtension, createBlockNoteAIClient } from '@blocknote/xl-ai';
import { useMemo } from 'react';

import { fetchAPI } from '@/api';
import { useConfig } from '@/core';
import { Doc } from '@/docs/doc-management';

const client = createBlockNoteAIClient({
  baseURL: ``,
  apiKey: '',
});

/**
 * Custom implementation of the PromptBuilder that allows for using predefined prompts.
 *
 * This extends the default HTML promptBuilder from BlockNote to support custom prompt templates.
 * Custom prompts can be invoked using the pattern !promptName in the AI input field.
 */
export const useAI = (docId: Doc['id']) => {
  const conf = useConfig().data;

  return useMemo(() => {
    if (!conf?.AI_MODEL) {
      return null;
    }

    const openai = createOpenAI({
      ...client.getProviderSettings('openai'),
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
    });

    return extension;
  }, [docId, conf?.AI_BOT, conf?.AI_MODEL]);
};
