import { createOpenAI } from '@ai-sdk/openai';
import {
  createAIExtension,
  createBlockNoteAIClient,
  llmFormats,
} from '@blocknote/xl-ai';
import { CoreMessage } from 'ai';
import { useMemo } from 'react';

import { fetchAPI } from '@/api';
import { useConfig } from '@/core';
import { Doc } from '@/docs/doc-management';

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
  }, [conf?.AI_BOT, conf?.AI_MODEL, docId]);
};
