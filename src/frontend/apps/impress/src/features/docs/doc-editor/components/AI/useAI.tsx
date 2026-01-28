import { AIExtension } from '@blocknote/xl-ai';
import { DefaultChatTransport } from 'ai';
import { useMemo } from 'react';

import { fetchAPI } from '@/api';
import { useConfig } from '@/core';
import { Doc } from '@/docs/doc-management';

export const useAI = (docId: Doc['id']) => {
  const conf = useConfig().data;

  return useMemo(() => {
    const extension = AIExtension({
      transport: new DefaultChatTransport({
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
      agentCursor: conf?.AI_BOT,
    });

    return extension;
  }, [conf?.AI_BOT, docId]);
};
