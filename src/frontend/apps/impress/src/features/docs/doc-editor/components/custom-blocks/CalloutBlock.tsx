import { defaultProps, insertOrUpdateBlock } from '@blocknote/core';
import {
  BlockTypeSelectItem,
  ReactCustomBlockImplementation,
  ReactCustomBlockRenderProps,
  createReactBlockSpec,
  useBlockNoteEditor,
  useEditorSelectionChange,
} from '@blocknote/react';
import { TFunction } from 'i18next';
import React, { useEffect, useState } from 'react';

import { Box, Emoji, EmojiPicker, Icon, Text } from '@/components';

import { DocsBlockNoteEditor } from '../../types';

const calloutEmojisCategory = {
  name: 'Callout',
  id: 'callout',
  emojis: [
    'bulb',
    'point_right',
    'point_up',
    'ok_hand',
    'key',
    'construction',
    'warning',
    'fire',
    'pushpin',
    'scissors',
    'question',
    'no_entry',
    'no_entry_sign',
    'alarm_clock',
    'phone',
    'rotating_light',
    'recycle',
    'white_check_mark',
    'lock',
    'paperclip',
    'book',
    'speaking_head_in_silhouette',
    'arrow_right',
    'loudspeaker',
    'hammer_and_wrench',
    'gear',
  ],
} as const;

const useCalloutBlock = () => {
  const editor = useBlockNoteEditor();
  const [openEmojiPicker, setOpenEmojiPicker] = useState(false);

  const toggleEmojiPicker = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenEmojiPicker(!openEmojiPicker);
  };

  const handleClickOutside = () => setOpenEmojiPicker(false);

  const handleEmojiSelect = (emoji: Emoji) => {
    const { block } = editor.getTextCursorPosition();
    const { native } = emoji;
    editor.updateBlock(block, { props: { emoji: native } });
    setOpenEmojiPicker(false);
  };

  return {
    openEmojiPicker,
    toggleEmojiPicker,
    handleClickOutside,
    handleEmojiSelect,
  };
};

const CalloutBlockElement: ReactCustomBlockImplementation = ({
  block,
  editor,
  contentRef,
}: ReactCustomBlockRenderProps) => {
  const {
    openEmojiPicker,
    toggleEmojiPicker,
    handleClickOutside,
    handleEmojiSelect,
  } = useCalloutBlock();

  return (
    <Box
      $padding="0.5rem 1rem"
      $gap="0.5rem"
      style={{
        flexGrow: 1,
        flexDirection: 'row',
      }}
    >
      <Text
        $as="span"
        contentEditable={false}
        onClick={toggleEmojiPicker}
        style={{ cursor: 'pointer' }}
      >
        {block.props.emoji}
      </Text>
      {openEmojiPicker && (
        <EmojiPicker
          customCategory={calloutEmojisCategory}
          onEmojiSelect={handleEmojiSelect}
          onClickOutside={handleClickOutside}
        />
      )}
      <Box as="p" className="inline-content" ref={contentRef} />
    </Box>
  );
};

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
  { render: CalloutBlockElement },
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
      icon: <Icon iconName="font_download" $size="18px" />,
      subtext: t('Add a callout block'),
    },
  ];

export const getCalloutFormattingToolbarItems = (
  t: TFunction<'translation', undefined>,
): BlockTypeSelectItem => ({
  name: t('Callout'),
  type: 'callout',
  icon: () => <Icon iconName="font_download" $size="16px" />,
  isSelected: (block) => block.type === 'callout',
});
