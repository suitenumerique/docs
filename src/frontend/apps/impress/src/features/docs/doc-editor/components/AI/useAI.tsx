import { createOpenAI } from '@ai-sdk/openai';
import { CoreMessage } from 'ai';
import { useMemo } from 'react';

import { fetchAPI } from '@/api';
import { useConfig } from '@/core';
import { Doc } from '@/docs/doc-management';

import { useModuleAI } from './useModuleAI';

const systemPrompts: Record<
  'add-assistant' | 'add-formatting' | 'add-edit-instruction',
  CoreMessage
> = {
  'add-assistant': {
    role: 'system',
    content:
      'You are an AI assistant that helps users to edit their documents. Answer the user prompt in markdown format.',
  },
  'add-formatting': {
    role: 'system',
    content: `Add formatting to the text to make it more readable.`,
  },
  'add-edit-instruction': {
    role: 'system',
    content: `Keep adding to the document, do not delete or modify existing blocks.`,
  },
};

const userPrompts: Record<string, string> = {
  'continue writing':
    'Keep writing about the content send in the prompt, expanding on the ideas.',
  'improve writing':
    'Improve the writing of the selected text. Make it more professional and clear.',
  summarize:
    'Summarize the selected text into a concise paragraph. Add a small summarize title above the text.',
};

/**
 * Custom implementation of the PromptBuilder that allows for using predefined prompts.
 *
 * This extends the default HTML promptBuilder from BlockNote to support custom prompt templates.
 * Custom prompts can be invoked using the pattern !promptName in the AI input field.
 */
export const useAI = (doc: Doc) => {
  const conf = useConfig().data;
  const modules = useModuleAI();
  const aiAllowed = !!(conf?.AI_FEATURE_ENABLED && doc.abilities?.ai_proxy);

  return useMemo(() => {
    if (!aiAllowed || !modules || !conf?.AI_MODEL) {
      return;
    }

    const { llmFormats, createAIExtension, createBlockNoteAIClient } = modules;

    const clientAI = createBlockNoteAIClient({
      baseURL: ``,
      apiKey: '',
    });

    const openai = createOpenAI({
      ...clientAI.getProviderSettings('openai'),
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
      // Create a custom promptBuilder that extends the default one
      promptBuilder: async (editor, opts): Promise<Array<CoreMessage>> => {
        const defaultPromptBuilder = llmFormats.html.defaultPromptBuilder;
        const isTransform = !!opts.selectedBlocks?.length;

        // Try to catch the action
        const customPromptMatch = opts.userPrompt.match(/^([^:]+)(?=[:]|$)/);

        let modifiedOpts = opts;
        if (customPromptMatch?.length) {
          const promptKey = customPromptMatch[0].trim().toLowerCase();

          if (userPrompts[promptKey]) {
            modifiedOpts = {
              ...opts,
              userPrompt: userPrompts[promptKey],
            };
          }
        }

        let prompts = await defaultPromptBuilder(editor, modifiedOpts);

        if (!isTransform) {
          prompts = prompts.map((prompt) => {
            if (!prompt.content || typeof prompt.content !== 'string') {
              return prompt;
            }

            /**
             * Fix a bug when the initial content is empty
             * TODO: Remove this when the bug is fixed in BlockNote
             */
            if (prompt.content === '[]') {
              editor.insertBlocks(
                [
                  {
                    id: 'base-block',
                    content: ' ',
                    type: 'paragraph',
                  },
                ],
                'initialBlockId',
                'after',
              );

              prompt.content =
                '[{\"id\":\"base-block$\",\"block\":\"<p></p>\"}]';
              return prompt;
            }

            if (
              prompt.content.includes(
                "You're manipulating a text document using HTML blocks.",
              )
            ) {
              prompt = systemPrompts['add-assistant'];
              return prompt;
            }

            if (
              prompt.content.includes(
                'First, determine what part of the document the user is talking about.',
              )
            ) {
              prompt = systemPrompts['add-edit-instruction'];
            }

            return prompt;
          });

          prompts.push(systemPrompts['add-formatting']);
        }

        return prompts;
      },
    });

    return extension;
  }, [aiAllowed, conf, doc.id, modules]);
};
