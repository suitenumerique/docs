/* eslint-disable react-hooks/rules-of-hooks */
import { defaultProps, insertOrUpdateBlock } from '@blocknote/core';
import { BlockTypeSelectItem, createReactBlockSpec } from '@blocknote/react';
import { TFunction } from 'i18next';
import React, { useEffect, useState } from 'react';
import { css } from 'styled-components';

import { Box, BoxButton, Icon } from '@/components';

import { DocsBlockNoteEditor } from '../../types';
import { EmojiPicker } from '../EmojiPicker';

import InitEmojiCallout from './initEmojiCallout';

export const CalloutBlock = createReactBlockSpec(
  {
    type: 'callout',
    propSchema: {
      textAlignment: defaultProps.textAlignment,
      backgroundColor: defaultProps.backgroundColor,
      emoji: { default: '💡' },
    },
    content: 'inline',
  },
  {
    render: ({ block, editor, contentRef }) => {
      const [openEmojiPicker, setOpenEmojiPicker] = useState(false);

      const toggleEmojiPicker = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setOpenEmojiPicker(!openEmojiPicker);
      };

      const onClickOutside = () => setOpenEmojiPicker(false);

      const onEmojiSelect = ({ native }: { native: string }) => {
        editor.updateBlock(block, { props: { emoji: native } });
        setOpenEmojiPicker(false);
      };

      // Temporary: sets a yellow background color to a callout block when added by
      // the user, while keeping the colors menu on the drag handler usable for
      // this custom block.
      useEffect(() => {
        if (
          !block.content.length &&
          block.props.backgroundColor === 'default'
        ) {
          editor.updateBlock(block, { props: { backgroundColor: 'yellow' } });
        }
      }, [block, editor]);

      return (
        <Box
          $padding="1rem"
          $gap="0.625rem"
          style={{
            flexGrow: 1,
            flexDirection: 'row',
          }}
        >
          <BoxButton
            contentEditable={false}
            onClick={toggleEmojiPicker}
            $css={css`
              font-size: 1.125rem;
              &:hover {
                background-color: rgba(0, 0, 0, 0.1);
              }
            `}
            $align="center"
            $height="28px"
            $width="28px"
            $radius="4px"
          >
            {block.props.emoji}
          </BoxButton>

          {openEmojiPicker && (
            <EmojiPicker
              emojiData={InitEmojiCallout.emojidata}
              categories={InitEmojiCallout.calloutCategories}
              onClickOutside={onClickOutside}
              onEmojiSelect={onEmojiSelect}
            />
          )}
          <Box as="p" className="inline-content" ref={contentRef} />
        </Box>
      );
    },
  },
);

export const getCalloutReactSlashMenuItems = (
  editor: DocsBlockNoteEditor,
  t: TFunction<'translation', undefined>,
  group: string,
) => [
  {
    title: t('Callout'),
    onItemClick: () => {
      insertOrUpdateBlock(editor, {
        type: 'callout',
      });
    },
    aliases: ['callout', 'encadré', 'hervorhebung', 'benadrukken'],
    group,
    icon: <Icon iconName="lightbulb" $size="18px" />,
    subtext: t('Add a callout block'),
  },
];

export const getCalloutFormattingToolbarItems = (
  t: TFunction<'translation', undefined>,
): BlockTypeSelectItem => ({
  name: t('Callout'),
  type: 'callout',
  icon: () => <Icon iconName="lightbulb" $size="16px" />,
  isSelected: (block) => block.type === 'callout',
});
