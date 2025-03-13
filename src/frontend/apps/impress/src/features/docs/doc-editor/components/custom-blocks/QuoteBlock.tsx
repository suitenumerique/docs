import { defaultProps, insertOrUpdateBlock } from '@blocknote/core';
import { BlockTypeSelectItem, createReactBlockSpec } from '@blocknote/react';
import { TFunction } from 'i18next';
import React from 'react';

import { Box, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';

import { DocsBlockNoteEditor } from '../../types';

export const QuoteBlock = createReactBlockSpec(
  {
    type: 'quote',
    propSchema: {
      textAlignment: defaultProps.textAlignment,
      textColor: defaultProps.textColor,
    },
    content: 'inline',
  },
  {
    render: (props) => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const { colorsTokens } = useCunninghamTheme();

      return (
        <Box
          as="blockquote"
          className="inline-content"
          $margin="0 0 1rem 0"
          $padding="0.5rem 1rem"
          style={{
            borderLeft: `4px solid ${colorsTokens()['greyscale-300']}`,
            fontStyle: 'italic',
            flexGrow: 1,
          }}
          $color="var(--c--theme--colors--greyscale-500)"
          ref={props.contentRef}
        />
      );
    },
  },
);

export const getQuoteReactSlashMenuItems = (
  editor: DocsBlockNoteEditor,
  t: TFunction<'translation', undefined>,
  group: string,
) => [
  {
    title: t('Quote'),
    onItemClick: () => {
      insertOrUpdateBlock(editor, {
        type: 'quote',
      });
    },
    aliases: ['quote', 'blockquote', 'citation'],
    group,
    icon: (
      <Text $isMaterialIcon $size="18px">
        format_quote
      </Text>
    ),
    subtext: t('Add a quote block'),
  },
];

export const getQuoteFormattingToolbarItems = (
  t: TFunction<'translation', undefined>,
): BlockTypeSelectItem => ({
  name: t('Quote'),
  type: 'quote',
  icon: () => (
    <Text $isMaterialIcon $size="16px">
      format_quote
    </Text>
  ),
  isSelected: (block) => block.type === 'quote',
});
