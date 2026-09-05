/**
 * Implementation of code block throws a errors when a `language` prop
 * is not supported by BlockNote, which crashes the whole editor.
 * In our case, the language is supported but flagged as an alias (e.g. `js` instead of `javascript`),
 * but Blocknote does not resolve aliases and throws an error.
 *
 * This file wraps the code block spec to normalize the `language` prop before BlockNote renders it,
 * so a single legacy code block does not crash the whole editor.
 *
 * See:
 * https://github.com/TypeCellOS/BlockNote/issues/3005
 * https://github.com/TypeCellOS/BlockNote/blob/main/packages/core/src/blocks/Code/CodeBlockOptions.ts
 * https://github.com/TypeCellOS/BlockNote/blob/63c2389e34be417bd4c03d7e047d304f5bfd6555/packages/core/src/blocks/Code/helpers/render/createCodeBlock.ts#L16-L18
 *
 * @TODO Remove this wrapper once BlockNote fixes the issue and supports aliases in the code block spec.
 */

import { codeBlockOptions } from '@blocknote/code-block';
import { createCodeBlockSpec } from '@blocknote/core';

const CODE_BLOCK_FALLBACK_LANGUAGE = 'text';

/**
 * Find the language id supported by BlockNote for a given language or alias.
 */
const codeBlockLanguageById = new Map<string, string>(
  Object.entries(codeBlockOptions.supportedLanguages).flatMap(
    ([id, language]) =>
      [id, ...(language.aliases ?? [])].map(
        (key) => [key.toLowerCase(), id] as const,
      ),
  ),
);

export const resolveCodeBlockLanguage = (language: unknown): string => {
  if (typeof language !== 'string') {
    return CODE_BLOCK_FALLBACK_LANGUAGE;
  }

  return (
    codeBlockLanguageById.get(language.trim().toLowerCase()) ??
    CODE_BLOCK_FALLBACK_LANGUAGE
  );
};

/**
 * Builds the code block spec, wrapping its `render` so an unsupported
 * `language` prop is normalized before BlockNote renders the language picker.
 * This prevents a single legacy code block from crashing the whole editor.
 */
export const createSafeCodeBlockSpec = (): ReturnType<
  typeof createCodeBlockSpec
> => {
  const spec = createCodeBlockSpec(codeBlockOptions);
  const baseRender = spec.implementation.render;

  return {
    ...spec,
    implementation: {
      ...spec.implementation,
      render(
        this: ThisParameterType<typeof baseRender>,
        ...args: Parameters<typeof baseRender>
      ): ReturnType<typeof baseRender> {
        const [block, editor] = args;
        const language = resolveCodeBlockLanguage(block.props.language);

        if (language === block.props.language) {
          return baseRender.apply(this, args);
        }

        return baseRender.call(
          this,
          { ...block, props: { ...block.props, language } },
          editor,
        );
      },
    },
  };
};
