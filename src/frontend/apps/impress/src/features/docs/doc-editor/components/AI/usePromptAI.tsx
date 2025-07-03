import { Block } from '@blocknote/core';
import { llmFormats } from '@blocknote/xl-ai';
import { CoreMessage } from 'ai';
import { TFunction } from 'i18next';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import {
  DocsBlockNoteEditor,
  DocsBlockSchema,
  DocsInlineContentSchema,
  DocsStyleSchema,
} from '../../types';

export type PromptBuilderInput = {
  userPrompt: string;
  selectedBlocks?: Block<
    DocsBlockSchema,
    DocsInlineContentSchema,
    DocsStyleSchema
  >[];
  excludeBlockIds?: string[];
  previousMessages?: Array<CoreMessage>;
};

type SystemPromptKey =
  | 'add-edit-instruction'
  | 'add-formatting'
  | 'add-markdown'
  | 'assistant'
  | 'language'
  | 'referenceId';

// Constants for prompt content matching
const PROMPT_INDICATORS = {
  HTML_BLOCKS: "You're manipulating a text document using HTML blocks.",
  EDIT_INSTRUCTION:
    'First, determine what part of the document the user is talking about.',
  ASSISTANT_IDENTIFIER: 'You are an AI assistant that edits user documents.',
  EMPTY_CONTENT: '[]',
} as const;

const createSystemPrompts = (
  t: TFunction<'translation', undefined>,
): Record<SystemPromptKey, CoreMessage> => ({
  assistant: {
    role: 'system',
    content: t('You are an AI assistant that edits user documents.'),
  },
  referenceId: {
    role: 'system',
    content: t(
      'Keep block IDs exactly as provided when referencing them (including the trailing "$").',
    ),
  },
  'add-markdown': {
    role: 'system',
    content: t('Answer the user prompt in markdown format.'),
  },
  'add-formatting': {
    role: 'system',
    content: t('Add formatting to the text to make it more readable.'),
  },
  'add-edit-instruction': {
    role: 'system',
    content: t(
      'Add content; do not delete or alter existing blocks unless explicitly told.',
    ),
  },
  language: {
    role: 'system',
    content: t(
      'Detect the dominant language inside the provided blocks. YOU MUST PROVIDE AN ANSWER IN THE DETECTED LANGUAGE.',
    ),
  },
});

const createUserPrompts = (
  t: TFunction<'translation', undefined>,
): Record<string, string> => ({
  'continue writing': t(
    'Keep writing about the content sent in the prompt, expanding on the ideas.',
  ),
  'improve writing': t(
    'Improve the writing of the selected text. Make it more professional and clear.',
  ),
  summarize: t('Summarize the document into a concise paragraph.'),
  'fix spelling': t(
    'Fix the spelling and grammar mistakes in the selected text.',
  ),
});

/**
 * Custom implementation of the PromptBuilder that allows for using predefined prompts.
 *
 * This extends the default HTML promptBuilder from BlockNote to support custom prompt templates.
 * Custom prompts can be invoked using the pattern !promptName in the AI input field.
 */
export const usePromptAI = () => {
  const { t } = useTranslation();

  const parseCustomPrompt = useCallback(
    (userPrompt: string, userPrompts: Record<string, string>) => {
      const customPromptMatch = userPrompt.match(/^([^:]+)(?=[:]|$)/);
      const promptKey = customPromptMatch?.[0].trim().toLowerCase();

      if (promptKey && userPrompts[promptKey]) {
        return {
          promptKey,
          modifiedPrompt: userPrompts[promptKey],
        };
      }

      return {
        promptKey,
        modifiedPrompt: userPrompt,
      };
    },
    [],
  );

  /**
   * Fix a bug when the initial content is empty
   * TODO: Remove this when the bug is fixed in BlockNote
   */
  const fixEmptyContentBug = useCallback(
    (prompt: CoreMessage, editor: DocsBlockNoteEditor): CoreMessage => {
      const lastBlockId = editor.document[editor.document.length - 1]?.id;
      return {
        role: prompt.role,
        content: `[{"id":"${lastBlockId}$","block":"<p></p>"}]`,
      } as CoreMessage;
    },
    [],
  );

  const transformPromptContent = useCallback(
    (
      prompt: CoreMessage,
      systemPrompts: Record<SystemPromptKey, CoreMessage>,
      editor: DocsBlockNoteEditor,
    ): CoreMessage => {
      if (!prompt.content || typeof prompt.content !== 'string') {
        return prompt;
      }

      // Fix empty content bug
      if (prompt.content.includes(PROMPT_INDICATORS.EMPTY_CONTENT)) {
        return fixEmptyContentBug(prompt, editor);
      }

      // Replace specific prompt content with system prompts
      if (prompt.content.includes(PROMPT_INDICATORS.HTML_BLOCKS)) {
        return systemPrompts['add-markdown'];
      }

      if (prompt.content.includes(PROMPT_INDICATORS.EDIT_INSTRUCTION)) {
        return systemPrompts['add-edit-instruction'];
      }

      return prompt;
    },
    [fixEmptyContentBug],
  );

  const addSystemPrompts = useCallback(
    (
      prompts: CoreMessage[],
      systemPrompts: Record<SystemPromptKey, CoreMessage>,
      hasAssistantPrompt: boolean,
      promptKey?: string,
    ): CoreMessage[] => {
      if (hasAssistantPrompt) {
        return prompts;
      }

      const newPrompts = [
        systemPrompts.assistant,
        ...prompts,
        systemPrompts.referenceId,
      ];

      // Add language prompt except when translating
      if (!promptKey?.includes('Translate into')) {
        newPrompts.push(systemPrompts.language);
      }

      return newPrompts;
    },
    [],
  );

  return useCallback(
    async (
      editor: DocsBlockNoteEditor,
      opts: PromptBuilderInput,
    ): Promise<Array<CoreMessage>> => {
      const systemPrompts = createSystemPrompts(t);
      const userPrompts = createUserPrompts(t);

      // Parse and modify user prompt if it matches a custom prompt
      const { promptKey, modifiedPrompt } = parseCustomPrompt(
        opts.userPrompt,
        userPrompts,
      );
      const modifiedOpts = { ...opts, userPrompt: modifiedPrompt };

      // Get initial prompts from BlockNote
      let prompts = await llmFormats.html.defaultPromptBuilder(
        editor,
        modifiedOpts,
      );

      const hasAssistantPrompt = prompts.some(
        (prompt) => prompt.content === PROMPT_INDICATORS.ASSISTANT_IDENTIFIER,
      );

      const hasSelectedBlocks = !!opts.selectedBlocks?.length;
      // Transform prompts for new content creation (no selected blocks)
      if (!hasSelectedBlocks) {
        prompts = prompts.map((prompt) =>
          transformPromptContent(prompt, systemPrompts, editor),
        );

        // Add formatting prompt if no assistant prompt exists
        if (!hasAssistantPrompt) {
          prompts.push(systemPrompts['add-formatting']);
        }
      }

      // Add system prompts if they don't exist
      prompts = addSystemPrompts(
        prompts,
        systemPrompts,
        hasAssistantPrompt,
        promptKey,
      );

      return prompts;
    },
    [parseCustomPrompt, transformPromptContent, addSystemPrompts, t],
  );
};
