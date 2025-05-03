import {
  CustomBlockConfig,
  DefaultInlineContentSchema,
  DefaultStyleSchema,
  defaultProps,
  insertOrUpdateBlock,
} from '@blocknote/core';
import {
  BlockTypeSelectItem,
  ReactCustomBlockImplementation,
  ReactCustomBlockRenderProps,
  createReactBlockSpec,
  useBlockNoteEditor,
} from '@blocknote/react';
import { TFunction } from 'i18next';
import React, { useEffect, useState } from 'react';

import {
  Box,
  Emoji,
  EmojiDataCategory,
  EmojiPicker,
  Icon,
  Text,
} from '@/components';

import {
  DocsBlockNoteEditor,
  DocsBlockSchema,
  DocsInlineContentSchema,
  DocsStyleSchema,
} from '../../types';

const calloutEmojisCategory: EmojiDataCategory = {
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

const calloutBlockConfig = {
  type: 'callout',
  propSchema: {
    textAlignment: defaultProps.textAlignment,
    backgroundColor: defaultProps.backgroundColor,
    emoji: { default: '💡' },
  },
  content: 'inline',
} satisfies CustomBlockConfig;

const useCalloutBlock = () => {
  const editor = useBlockNoteEditor<
    DocsBlockSchema,
    DocsInlineContentSchema,
    DocsStyleSchema
  >();
  const [openEmojiPicker, setOpenEmojiPicker] = useState(false);

  const toggleEmojiPicker = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenEmojiPicker(!openEmojiPicker);
  };

  const handleClickOutside = () => setOpenEmojiPicker(false);

  const handleEmojiSelect = (emoji: Emoji) => {
    const { block } = editor.getTextCursorPosition();
    editor.updateBlock(block, { props: { emoji: emoji.native } });
    setOpenEmojiPicker(false);
  };

  return {
    openEmojiPicker,
    toggleEmojiPicker,
    handleClickOutside,
    handleEmojiSelect,
  };
};

const CalloutBlockElement = ({
  block,
  editor,
  contentRef,
}: ReactCustomBlockRenderProps<
  typeof calloutBlockConfig,
  DefaultInlineContentSchema,
  DefaultStyleSchema
>) => {
  const {
    openEmojiPicker,
    toggleEmojiPicker,
    handleClickOutside,
    handleEmojiSelect,
  } = useCalloutBlock();

  // Temporary: sets a yellow background color to a callout block when added by
  // the user, while keeping the colors menu on the drag handler usable for
  // this custom block.
  useEffect(() => {
    if (!block.content.length && block.props.backgroundColor === 'default') {
      editor.updateBlock(block, { props: { backgroundColor: 'yellow' } });
    }
  }, []);

  return (
    <Box
      $padding="1rem"
      $gap="0.625rem"
      style={{
        flexGrow: 1,
        flexDirection: 'row',
      }}
    >
      <Text
        as="span"
        className="docs--editor-callout-block-emoji"
        contentEditable={false}
        onClick={toggleEmojiPicker}
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

const calloutImplementation = {
  render: CalloutBlockElement,
} satisfies ReactCustomBlockImplementation<
  typeof calloutBlockConfig,
  DefaultInlineContentSchema,
  DefaultStyleSchema
>;

export const CalloutBlock = createReactBlockSpec(
  calloutBlockConfig,
  calloutImplementation,
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
