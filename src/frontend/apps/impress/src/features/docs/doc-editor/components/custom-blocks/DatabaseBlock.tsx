/* eslint-disable react-hooks/rules-of-hooks */
import { defaultProps, insertOrUpdateBlock } from '@blocknote/core';
import { BlockTypeSelectItem, createReactBlockSpec } from '@blocknote/react';
import { TFunction } from 'i18next';
import React, { useEffect } from 'react';
import { css } from 'styled-components';

import { Box, Icon } from '@/components';

import { DocsBlockNoteEditor } from '../../types';

export const DatabaseBlock = createReactBlockSpec(
  {
    type: 'database',
    propSchema: {
      textAlignment: defaultProps.textAlignment,
      backgroundColor: defaultProps.backgroundColor,
      emoji: { default: '💡' },
    },
    content: 'inline',
  },
  {
    render: ({ block, editor, contentRef }) => {
      // Temporary: sets a yellow background color to a database block when added by
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
          <Box as="p" className="inline-content" ref={contentRef} />
        </Box>
      );
    },
  },
);

export const getDatabaseReactSlashMenuItems = (
  editor: DocsBlockNoteEditor,
  t: TFunction<'translation', undefined>,
  group: string,
) => [
  {
    title: t('Database'),
    onItemClick: () => {
      insertOrUpdateBlock(editor, {
        type: 'database',
      });
    },
    aliases: ['database', 'db', 'base de donnée'],
    group,
    icon: <Icon iconName="storage" $size="18px" />,
    subtext: t('Create database view synced with Grist'),
  },
];

// TODO: remove if unused
export const getDatabaseFormattingToolbarItems = (
  t: TFunction<'translation', undefined>,
): BlockTypeSelectItem => ({
  name: t('Database'),
  type: 'database',
  icon: () => <Icon iconName="storage" $size="16px" />,
  isSelected: (block) => block.type === 'database',
});
