import { useBlockNoteEditor, useComponentsContext } from '@blocknote/react';
import { getAIExtension } from '@blocknote/xl-ai';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';

import IconAI from '../../assets/IconAI.svg';
import {
  DocsBlockSchema,
  DocsInlineContentSchema,
  DocsStyleSchema,
} from '../../types';

export const AIToolbarButton = () => {
  const Components = useComponentsContext();
  const { t } = useTranslation();
  const { spacingsTokens, colorsTokens } = useCunninghamTheme();

  const editor = useBlockNoteEditor<
    DocsBlockSchema,
    DocsInlineContentSchema,
    DocsStyleSchema
  >();

  const ai = getAIExtension(editor);

  const onClick = () => {
    editor.formattingToolbar.closeMenu();
    const selection = editor.getSelection();
    if (!selection) {
      throw new Error('No selection');
    }
    const position = selection.blocks[selection.blocks.length - 1].id;
    ai.openAIMenuAtBlock(position);
  };

  if (!editor.isEditable || !Components) {
    return null;
  }

  return (
    <Box
      $css={css`
        & > button.mantine-Button-root {
          padding-inline: ${spacingsTokens['2xs']};
          transition: all 0.1s ease-in;
          &:hover,
          &:hover {
            background-color: ${colorsTokens['greyscale-050']};
          }
          &:hover .--docs--icon-bg {
            background-color: #5858e1;
            border: 1px solid #8484f5;
            color: #ffffff;
          }
        }
      `}
      $direction="row"
    >
      <Components.Generic.Toolbar.Button
        className="bn-button"
        onClick={onClick}
      >
        <Box
          $direction="row"
          $align="center"
          $gap={spacingsTokens['xs']}
          $padding={{ right: '2xs' }}
        >
          <Text
            className="--docs--icon-bg"
            $theme="greyscale"
            $variation="600"
            $css={css`
              border: 1px solid var(--c--theme--colors--greyscale-100);
              transition: all 0.1s ease-in;
            `}
            $radius="100%"
            $padding="0.15rem"
          >
            <IconAI width="16px" />
          </Text>
          {t('Ask AI')}
        </Box>
      </Components.Generic.Toolbar.Button>
      <Box
        $background={colorsTokens['greyscale-100']}
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
