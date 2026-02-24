import {
  BlockConfig,
  BlockNoDefaults,
  BlockNoteEditor,
  InlineContentSchema,
  StyleSchema,
  defaultProps,
} from '@blocknote/core';
import { insertOrUpdateBlockForSlashMenu } from '@blocknote/core/extensions';
import { BlockTypeSelectItem, createReactBlockSpec } from '@blocknote/react';
import { TFunction } from 'i18next';
import React, { useEffect, useState } from 'react';
import { createGlobalStyle, css } from 'styled-components';

import { Box, BoxButton, EmojiPicker, Icon, emojidata } from '@/components';

import { DocsBlockNoteEditor } from '../../types';

const CalloutBlockStyle = createGlobalStyle`
  .bn-block-content[data-content-type="callout"][data-background-color] {
    padding: var(--c--globals--spacings--3xs) var(--c--globals--spacings--3xs);
    border-radius: var(--c--globals--spacings--3xs);
  }
  .bn-block-content[data-content-type="callout"] .inline-content {
    white-space: pre-wrap;
  }
`;

type CreateCalloutBlockConfig = BlockConfig<
  'callout',
  {
    textAlignment: typeof defaultProps.textAlignment;
    backgroundColor: typeof defaultProps.backgroundColor;
    emoji: { default: '💡' };
  },
  'inline'
>;

interface CalloutComponentProps {
  block: BlockNoDefaults<
    Record<'callout', CreateCalloutBlockConfig>,
    InlineContentSchema,
    StyleSchema
  >;
  editor: BlockNoteEditor<
    Record<'callout', CreateCalloutBlockConfig>,
    InlineContentSchema,
    StyleSchema
  >;
  contentRef: (node: HTMLElement | null) => void;
}

const CalloutComponent = ({
  block,
  editor,
  contentRef,
}: CalloutComponentProps) => {
  const [openEmojiPicker, setOpenEmojiPicker] = useState(false);
  const isEditable = editor.isEditable;

  const toggleEmojiPicker = (e: React.MouseEvent) => {
    if (!isEditable) {
      return;
    }
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
    if (!block.content.length && block.props.backgroundColor === 'default') {
      // Delay the update to avoid interfering with the block insertion process
      setTimeout(() => {
        editor.updateBlock(block, { props: { backgroundColor: 'yellow' } });
      }, 0);
    }
  }, [block, editor]);

  return (
    <Box
      $padding="1rem"
      $gap="0.625rem"
      $direction="row"
      $align="center"
      $css={css`
        flex-grow: 1;
      `}
    >
      <CalloutBlockStyle />
      <Box
        $position="relative"
        $css={css`
          align-self: start;
        `}
      >
        <BoxButton
          contentEditable={false}
          onClick={toggleEmojiPicker}
          $css={css`
            font-size: 1.125rem;
            cursor: ${isEditable ? 'pointer' : 'default'};
            ${isEditable &&
            `
          &:hover {
            background-color: rgba(0, 0, 0, 0.1);
          }
          `}
          `}
          $align="center"
          $width="28px"
          $radius="4px"
        >
          {block.props.emoji}
        </BoxButton>

        {openEmojiPicker && (
          <EmojiPicker
            emojiData={emojidata}
            onClickOutside={onClickOutside}
            onEmojiSelect={onEmojiSelect}
            withOverlay={true}
          />
        )}
      </Box>
      <Box as="p" className="inline-content" ref={contentRef} />
    </Box>
  );
};

export const CalloutBlock = createReactBlockSpec(
  {
    type: 'callout',
    propSchema: {
      textAlignment: defaultProps.textAlignment,
      backgroundColor: { default: 'default' as const },
      emoji: { default: '💡' },
    },
    content: 'inline',
  },
  {
    render: ({ block, editor, contentRef }) => (
      <CalloutComponent block={block} editor={editor} contentRef={contentRef} />
    ),
  },
);

export const getCalloutReactSlashMenuItems = (
  editor: DocsBlockNoteEditor,
  t: TFunction<'translation', undefined>,
  group: string,
) => [
  {
    key: 'callout',
    title: t('Callout'),
    onItemClick: () => {
      insertOrUpdateBlockForSlashMenu(editor, {
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
});
