/* eslint-disable react-hooks/rules-of-hooks */
import { defaultProps, insertOrUpdateBlock } from '@blocknote/core';
import { BlockTypeSelectItem, createReactBlockSpec } from '@blocknote/react';
import { TFunction } from 'i18next';
import React, { useEffect } from 'react';

import { Box, Icon } from '@/components';
import { useGristTable } from '@/features/grist';

import { DocsBlockNoteEditor } from '../../types';

export const DatabaseBlock = createReactBlockSpec(
  {
    type: 'database',
    propSchema: {
      textAlignment: defaultProps.textAlignment,
      backgroundColor: defaultProps.backgroundColor,
      documentId: {
        type: 'string',
        default: '',
      },
      tableId: {
        type: 'string',
        default: '',
      },
    },
    content: 'inline',
  },
  {
    render: ({ block, editor, contentRef }) => {
      const { tableData } = useGristTable({
        tableId: block.props.tableId,
        documentId: block.props.documentId,
      });

      useEffect(() => {
        if (
          !block.content.length &&
          block.props.backgroundColor === 'default'
        ) {
          editor.updateBlock(block, { props: { backgroundColor: 'orange' } });
        } else {
          editor.updateBlock(block, { content: JSON.stringify(tableData) });
        }
      }, [block, editor, tableData]);

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
