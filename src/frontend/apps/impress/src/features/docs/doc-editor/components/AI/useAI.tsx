import { createOpenAI } from '@ai-sdk/openai';
import { useMemo } from 'react';

import { fetchAPI } from '@/api';
import { useConfig } from '@/core';
import { Doc } from '@/docs/doc-management';

import { useModuleAI } from './useModuleAI';
import { usePromptAI } from './usePromptAI';

export const useAI = (doc: Doc) => {
  const conf = useConfig().data;
  const modules = useModuleAI();
  const aiAllowed = !!(conf?.AI_FEATURE_ENABLED && doc.abilities?.ai_proxy);
  const promptBuilder = usePromptAI();

  return useMemo(() => {
    if (!aiAllowed || !modules || !conf?.AI_MODEL) {
      return;
    }

    const { createAIExtension, llmFormats } = modules;

    const openai = createOpenAI({
      apiKey: '', // The API key will be set by the AI proxy
      fetch: (input, init) => {
        // Create a new headers object without the Authorization header
        const headers = new Headers(init?.headers);
        headers.delete('Authorization');

        return fetchAPI(`documents/${doc.id}/ai-proxy/`, {
          ...init,
          headers,
        });
      },
    });
    const model = openai.chat(conf.AI_MODEL);

    const extension = createAIExtension({
      stream: conf.AI_STREAM,
      model,
      agentCursor: conf.AI_BOT,
      promptBuilder: promptBuilder(llmFormats.html.defaultPromptBuilder),
    });

    return extension;
  }, [
    aiAllowed,
    conf?.AI_BOT,
    conf?.AI_MODEL,
    conf?.AI_STREAM,
    doc.id,
    modules,
    promptBuilder,
  ]);
};
