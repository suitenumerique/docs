/* eslint-disable react-hooks/rules-of-hooks */
import { defaultProps, insertOrUpdateBlock } from '@blocknote/core';
import { BlockTypeSelectItem, createReactBlockSpec } from '@blocknote/react';
import { Button } from '@openfun/cunningham-react';
import { TFunction } from 'i18next';
import React from 'react';

import { Box, Icon, Text } from '@/components';

import { DocsBlockNoteEditor } from '../../types';
import { DatabaseSourceSelector } from '../DatabaseSourceSelector';

import { DatabaseGrid } from './DatabaseBlock/DatabaseGrid';

export const DatabaseBlock = createReactBlockSpec(
  {
    type: 'database',
    propSchema: {
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
    render: ({ block, editor }) => {
      return (
        <Box
          $padding="1rem"
          $gap="0.625rem"
          style={{
            flexGrow: 1,
            flexDirection: 'row',
            width: '100%',
          }}
        >
          <Box as="div" />
          {block.props.documentId && block.props.tableId ? (
            <Box style={{ height: '100%', width: '100%' }}>
              <DatabaseGrid
                documentId={block.props.documentId}
                tableId={block.props.tableId}
              />
            </Box>
          ) : (
            <Box
              style={{
                flexDirection: 'column',
                gap: 10,
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
              }}
            >
              <Button
                onClick={() => {
                  console.log('coucou');
                }}
              >
                Créer une nouvelle base de données vide
              </Button>
              <Text>ou</Text>
              <DatabaseSourceSelector
                onSourceSelected={({ documentId, tableId }) => {
                  editor.updateBlock(block, {
                    props: { documentId: documentId.toString(), tableId },
                  });
                }}
              />
            </Box>
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
