/* eslint-disable react-hooks/rules-of-hooks */
import { insertOrUpdateBlock } from '@blocknote/core';
import { createReactBlockSpec } from '@blocknote/react';
import { Button } from '@openfun/cunningham-react';
import { TFunction } from 'i18next';
import React from 'react';

import { Box, Icon, Text } from '@/components';

import { DocsBlockNoteEditor } from '../../types';
import { DatabaseSourceSelector } from '../DatabaseSourceSelector';
import { DatabaseTableDisplay } from '../DatabaseTableDisplay';

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
            <Box>
              <DatabaseTableDisplay
                documentId={block.props.documentId}
                tableId={block.props.tableId}
              />
              <Box style={{ height: '100%', width: '100%' }}>
                <DatabaseGrid />
              </Box>
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
              <Button>Créer une nouvelle base de données vide</Button>
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
    aliases: ['database', 'db', 'base de données'],
    group,
    icon: <Icon iconName="storage" $size="18px" />,
    subtext: t('Create database view synced with Grist'),
  },
];
