import { useBlockNoteEditor, useComponentsContext } from '@blocknote/react';
import {
  AIMenu as AIMenuDefault,
  getAIExtension,
  getDefaultAIMenuItems,
} from '@blocknote/xl-ai';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';

import IconAI from '../../assets/IconAI.svg';
import {
  DocsBlockNoteEditor,
  DocsBlockSchema,
  DocsInlineContentSchema,
  DocsStyleSchema,
} from '../../types';

export function AIMenu() {
  return (
    <AIMenuDefault
      items={(editor: DocsBlockNoteEditor, aiResponseStatus) => {
        if (aiResponseStatus === 'user-input') {
          if (editor.getSelection()) {
            const aiMenuItems = getDefaultAIMenuItems(
              editor,
              aiResponseStatus,
            ).filter((item) => ['simplify'].indexOf(item.key) === -1);

            return aiMenuItems;
          } else {
            const aiMenuItems = getDefaultAIMenuItems(
              editor,
              aiResponseStatus,
            ).filter(
              (item) =>
                ['action_items', 'write_anything'].indexOf(item.key) === -1,
            );

            return aiMenuItems;
          }
        }

        return getDefaultAIMenuItems(editor, aiResponseStatus);
      }}
    />
  );
}

export const AIToolbarButton = () => {
  const Components = useComponentsContext();
  const { t } = useTranslation();
  const { spacingsTokens, colorsTokens } = useCunninghamTheme();
  const editor = useBlockNoteEditor<
    DocsBlockSchema,
    DocsInlineContentSchema,
    DocsStyleSchema
  >();

  if (!editor.isEditable || !Components) {
    return null;
  }

  const onClick = () => {
    const aiExtension = getAIExtension(editor);
    editor.formattingToolbar.closeMenu();
    const selection = editor.getSelection();
    if (!selection) {
      throw new Error('No selection');
    }

    const position = selection.blocks[selection.blocks.length - 1].id;
    aiExtension.openAIMenuAtBlock(position);
  };

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
      className="--docs--ai-toolbar-button"
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
