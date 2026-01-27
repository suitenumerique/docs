import { AIExtension, ClientSideTransport } from '@blocknote/xl-ai';
import { useMemo } from 'react';

import { baseApiUrl, fetchAPI } from '@/api';
import { useConfig } from '@/core';
import { Doc } from '@/docs/doc-management';
import { createOpenAI } from "@ai-sdk/openai";
//import { usePromptAI } from './usePromptAI';

export const useAI = (docId: Doc['id'], aiAllowed: boolean) => {
  const conf = useConfig().data;
  //const promptBuilder = usePromptAI();

  return useMemo(() => {
    if (!aiAllowed || !conf?.AI_MODEL) {
      return;
    }

    const aIprovider = createOpenAI({
      baseURL: `${baseApiUrl("1.0")}documents/${docId}/ai-proxy/`,
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
      transport: new ClientSideTransport({ model }),
    });

    return extension;
  }, [aiAllowed, conf, docId]);
};
