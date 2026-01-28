/**
 * We have to override the default BlockNote AI Toolbar Button to customize its appearance.
 *
 * See original implementation:
 * https://github.com/TypeCellOS/BlockNote/blob/main/packages/xl-ai/src/components/FormattingToolbar/AIToolbarButton.tsx
 */
import { FormattingToolbarExtension } from '@blocknote/core/extensions';
import {
  useBlockNoteEditor,
  useComponentsContext,
  useExtension,
  useSelectedBlocks,
} from '@blocknote/react';
import { AIExtension } from '@blocknote/xl-ai';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box } from '@/components';
import { useCunninghamTheme } from '@/cunningham';

import {
  DocsBlockSchema,
  DocsInlineContentSchema,
  DocsStyleSchema,
} from '../../types';

import { IconAI } from './IconAI';

export const AIToolbarButton = () => {
  const { t } = useTranslation();
  const Components = useComponentsContext();
  const { spacingsTokens, colorsTokens } = useCunninghamTheme();
  const editor = useBlockNoteEditor<
    DocsBlockSchema,
    DocsInlineContentSchema,
    DocsStyleSchema
  >();
  const ai = useExtension(AIExtension);
  const formattingToolbar = useExtension(FormattingToolbarExtension);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const selectedBlocks = useSelectedBlocks(editor);
  const isContent = useMemo(() => {
    return !!selectedBlocks.find((block) => block.content !== undefined);
  }, [selectedBlocks]);

  if (!editor.isEditable || !Components || !isContent) {
    return null;
  }

  const onClick = () => {
    const selection = editor.getSelection();
    if (!selection) {
      throw new Error('No selection');
    }

    const position = selection.blocks[selection.blocks.length - 1].id;

    ai.openAIMenuAtBlock(position);
    formattingToolbar.store.setState(false);
  };

  return (
    <Box
      $css={css`
        & > button.mantine-Button-root {
          padding-inline: 0;
          transition: all 0.1s ease-in;
          & .mantine-Button-label {
            padding-inline: ${spacingsTokens['2xs']};
          }
          &:hover,
          &:hover {
            background-color: ${colorsTokens['gray-050']};
          }
        }
      `}
      onMouseEnter={() => setIsHighlighted(true)}
      onMouseLeave={() => setIsHighlighted(false)}
      $direction="row"
      className="--docs--ai-toolbar-button"
    >
      <Components.Generic.Toolbar.Button
        className="bn-button"
        onClick={onClick}
      >
        <Box
          as="span"
          $direction="row"
          $align="center"
          $gap={spacingsTokens['xs']}
          $padding={{ right: '2xs' }}
        >
          <IconAI isHighlighted={isHighlighted} width="18px" />
          {t('Ask AI')}
        </Box>
      </Components.Generic.Toolbar.Button>
      <Box
        $background={colorsTokens['gray-100']}
        $width="1px"
        $height="70%"
        $margin={{ left: '2px' }}
        $css={css`
          align-self: center;
        `}
      />
    </Box>
  );
};
