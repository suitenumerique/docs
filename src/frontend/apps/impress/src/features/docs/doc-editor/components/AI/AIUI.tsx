import { FormattingToolbarExtension } from '@blocknote/core/extensions';
import {
  useBlockNoteEditor,
  useComponentsContext,
  useExtension,
} from '@blocknote/react';
import {
  AIExtension,
  AIMenu as AIMenuDefault,
  getDefaultAIMenuItems,
} from '@blocknote/xl-ai';
import '@blocknote/xl-ai/style.css';
import { useTranslation } from 'react-i18next';
import { createGlobalStyle, css } from 'styled-components';

import { Box, Icon, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';

import IconAI from '../../assets/IconAI.svg';
import IconWandStar from '../../assets/wand_stars.svg';
import {
  DocsBlockNoteEditor,
  DocsBlockSchema,
  DocsInlineContentSchema,
  DocsStyleSchema,
} from '../../types';

const AIMenuStyle = createGlobalStyle`
  #ai-suggestion-menu .bn-suggestion-menu-item-small .bn-mt-suggestion-menu-item-section[data-position=left] svg {
    height: 18px;
    width: 18px;
  }
`;

export function AIMenu() {
  return (
    <>
      <AIMenuStyle />
      <AIMenuDefault
        items={(editor: DocsBlockNoteEditor, aiResponseStatus) => {
          if (aiResponseStatus === 'user-input') {
            let aiMenuItems = getDefaultAIMenuItems(editor, aiResponseStatus);

            if (editor.getSelection()) {
              aiMenuItems = aiMenuItems.filter(
                (item) => ['simplify'].indexOf(item.key) === -1,
              );

              aiMenuItems = aiMenuItems.map((item) => {
                if (item.key === 'improve_writing') {
                  return {
                    ...item,
                    icon: <IconWandStar />,
                  };
                } else if (item.key === 'translate') {
                  return {
                    ...item,
                    icon: (
                      <Icon
                        iconName="translate"
                        $color="inherit"
                        $size="18px"
                      />
                    ),
                  };
                }

                return item;
              });
            } else {
              aiMenuItems = aiMenuItems.filter(
                (item) =>
                  ['action_items', 'write_anything'].indexOf(item.key) === -1,
              );
            }

            return aiMenuItems;
          } else if (aiResponseStatus === 'user-reviewing') {
            return getDefaultAIMenuItems(editor, aiResponseStatus).map(
              (item) => {
                if (item.key === 'accept') {
                  return {
                    ...item,
                    icon: (
                      <Icon
                        iconName="check_circle"
                        $color="inherit"
                        $size="18px"
                      />
                    ),
                  };
                }
                return item;
              },
            );
          }

          return getDefaultAIMenuItems(editor, aiResponseStatus);
        }}
      />
    </>
  );
}

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

  if (!editor.isEditable || !Components) {
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
          padding-inline: ${spacingsTokens['2xs']};
          transition: all 0.1s ease-in;
          &:hover,
          &:hover {
            background-color: ${colorsTokens['gray-050']};
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
