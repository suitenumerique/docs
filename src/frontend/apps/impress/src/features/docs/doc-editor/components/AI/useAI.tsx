import { createOpenAI } from '@ai-sdk/openai';
import { AIExtension, ClientSideTransport } from '@blocknote/xl-ai';
import { useMemo } from 'react';

import { baseApiUrl, fetchAPI } from '@/api';
import { useConfig } from '@/core';
import { Doc } from '@/docs/doc-management';

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

    const aIprovider = createOpenAI({
      apiKey: '',
      baseURL: `${baseApiUrl('1.0')}documents/${docId}/ai-proxy/`,
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

    const model = aIprovider.chat(conf.AI_MODEL);

    const extension = AIExtension({
      agentCursor: conf.AI_BOT,
      transport: new ClientSideTransport({
        model,
        stream: conf.AI_STREAM,
        _additionalOptions: {
          temperature: 0,
        },
      }),
    });

    return extension;
  }, [conf?.AI_MODEL, conf?.AI_BOT, conf?.AI_STREAM, docId]);
};
