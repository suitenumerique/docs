import { AIExtension } from '@blocknote/xl-ai';
import { DefaultChatTransport } from 'ai';
import { useMemo } from 'react';

import { fetchAPI } from '@/api';
import { useConfig } from '@/core';
import { Doc } from '@/docs/doc-management';

/**
 * Custom implementation of the PromptBuilder that allows for using predefined prompts.
 *
 * This extends the default HTML promptBuilder from BlockNote to support custom prompt templates.
 * Custom prompts can be invoked using the pattern !promptName in the AI input field.
 */
export const useAI = (docId: Doc['id'], aiAllowed: boolean) => {
  const conf = useConfig().data;

  return useMemo(() => {
    if (!aiAllowed || !conf?.AI_MODEL) {
      return null;
    }

    //const model = aIprovider.chat(conf.AI_MODEL);

    const extension = AIExtension({
      transport: new DefaultChatTransport({
        // URL to your backend API, see example source in `packages/xl-ai-server/src/routes/regular.ts`
        fetch: (input, init) => {
          // Create a new headers object without the Authorization header
          const headers = new Headers(init?.headers);
          headers.delete('Authorization');

          return fetchAPI(`documents/${docId}/ai-proxy/`, {
            ...init,
            headers,
          });
        },
      }),
      agentCursor: conf.AI_BOT,
    });

    // const extension = AIExtension({
    //   agentCursor: conf.AI_BOT,
    //   transport: new ClientSideTransport({
    //     model,
    //     stream: conf.AI_STREAM,
    //     _additionalOptions: {
    //       temperature: 0,
    //     },
    //   }),
    // });

    return extension;
  }, [aiAllowed, conf?.AI_MODEL, conf?.AI_BOT, docId]);
};
