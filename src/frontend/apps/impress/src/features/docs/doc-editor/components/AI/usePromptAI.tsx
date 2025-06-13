import { Block } from '@blocknote/core';
import { CoreMessage } from 'ai';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { DocsBlockNoteEditor } from '../../types';

export type PromptBuilderInput = {
  userPrompt: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selectedBlocks?: Block<any, any, any>[];
  excludeBlockIds?: string[];
  previousMessages?: Array<CoreMessage>;
};

type PromptBuilder = (
  editor: DocsBlockNoteEditor,
  opts: PromptBuilderInput,
) => Promise<Array<CoreMessage>>;

/**
 * Custom implementation of the PromptBuilder that allows for using predefined prompts.
 *
 * This extends the default HTML promptBuilder from BlockNote to support custom prompt templates.
 * Custom prompts can be invoked using the pattern !promptName in the AI input field.
 */
export const usePromptAI = () => {
  const { t } = useTranslation();

  return useCallback(
    (defaultPromptBuilder: PromptBuilder) =>
      async (
        editor: DocsBlockNoteEditor,
        opts: PromptBuilderInput,
      ): Promise<Array<CoreMessage>> => {
        const systemPrompts: Record<
          | 'add-edit-instruction'
          | 'add-formatting'
          | 'add-markdown'
          | 'assistant'
          | 'language'
          | 'referenceId',
          CoreMessage
        > = {
          assistant: {
            role: 'system',
            content: t(`You are an AI assistant that edits user documents.`),
          },
          referenceId: {
            role: 'system',
            content: t(
              `Keep block IDs exactly as provided when referencing them (including the trailing "$").`,
            ),
          },
          'add-markdown': {
            role: 'system',
            content: t(`Answer the user prompt in markdown format.`),
          },
          'add-formatting': {
            role: 'system',
            content: t(`Add formatting to the text to make it more readable.`),
          },
          'add-edit-instruction': {
            role: 'system',
            content: t(
              `Add content; do not delete or alter existing blocks unless explicitly told.`,
            ),
          },
          language: {
            role: 'system',
            content: t(
              `Detect the dominant language inside the provided blocks. YOU MUST PROVIDE A ANSWER IN THE DETECTED LANGUAGE.`,
            ),
          },
        };

        const userPrompts: Record<string, string> = {
          'continue writing': t(
            'Keep writing about the content send in the prompt, expanding on the ideas.',
          ),
          'improve writing': t(
            'Improve the writing of the selected text. Make it more professional and clear.',
          ),
          summarize: t('Summarize the document into a concise paragraph.'),
          'fix spelling': t(
            'Fix the spelling and grammar mistakes in the selected text.',
          ),
        };

        // Modify userPrompt if it matches a custom prompt
        const customPromptMatch = opts.userPrompt.match(/^([^:]+)(?=[:]|$)/);
        let modifiedOpts = opts;
        const promptKey = customPromptMatch?.[0].trim().toLowerCase();
        if (promptKey) {
          if (userPrompts[promptKey]) {
            modifiedOpts = {
              ...opts,
              userPrompt: userPrompts[promptKey],
            };
          }
        }

        let prompts = await defaultPromptBuilder(editor, modifiedOpts);
        const isTransformExistingContent = !!opts.selectedBlocks?.length;
        if (!isTransformExistingContent) {
          prompts = prompts.map((prompt) => {
            if (!prompt.content || typeof prompt.content !== 'string') {
              return prompt;
            }

            /**
             * Fix a bug when the initial content is empty
             * TODO: Remove this when the bug is fixed in BlockNote
             */
            if (prompt.content === '[]') {
              const lastBlockId =
                editor.document[editor.document.length - 1].id;

              prompt.content = `[{\"id\":\"${lastBlockId}$\",\"block\":\"<p></p>\"}]`;
              return prompt;
            }

            if (
              prompt.content.includes(
                "You're manipulating a text document using HTML blocks.",
              )
            ) {
              prompt = systemPrompts['add-markdown'];
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

        prompts.unshift(systemPrompts['assistant']);
        prompts.push(systemPrompts['referenceId']);

        // Try to keep the language of the document except when we are translating
        if (!promptKey?.includes('Translate into')) {
          prompts.push(systemPrompts['language']);
        }

        return prompts;
      },
    [t],
  );
};
