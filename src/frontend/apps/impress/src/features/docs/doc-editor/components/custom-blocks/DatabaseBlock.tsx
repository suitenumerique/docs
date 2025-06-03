/* eslint-disable react-hooks/rules-of-hooks */
import { insertOrUpdateBlock } from '@blocknote/core';
import { BlockTypeSelectItem, createReactBlockSpec } from '@blocknote/react';
import { TFunction } from 'i18next';
import React from 'react';

import { Box, Icon } from '@/components';

import { DocsBlockNoteEditor } from '../../types';
import { DatabaseSelector } from '../DatabaseSelector';

import { DatabaseGrid } from './DatabaseBlock/DatabaseGrid';

export const DatabaseBlock = createReactBlockSpec(
  {
    type: 'database',
    propSchema: {
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
    render: ({ block, editor }) => {
      return (
        <Box
          style={{
            flexGrow: 1,
            flexDirection: 'row',
            width: '100%',
          }}
        >
          {block.props.documentId && block.props.tableId ? (
            <Box
              style={{
                height: '100%',
                width: '100%',
                flexDirection: 'row',
              }}
            >
              <DatabaseGrid
                documentId={block.props.documentId}
                tableId={block.props.tableId}
              />
            </Box>
          ) : (
            <DatabaseSelector
              onDatabaseSelected={({ documentId, tableId }) => {
                editor.updateBlock(block, {
                  props: { documentId: documentId.toString(), tableId },
                });
              }}
            />
          )}
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
