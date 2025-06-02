/* eslint-disable react-hooks/rules-of-hooks */
import { insertOrUpdateBlock } from '@blocknote/core';
import { createReactBlockSpec } from '@blocknote/react';
import { Button } from '@openfun/cunningham-react';
import { ColDef } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { TFunction } from 'i18next';
import React, { useRef } from 'react';

import { Box, Icon, Text } from '@/components';

import { DocsBlockNoteEditor } from '../../types';
import { DatabaseSourceSelector } from '../DatabaseSourceSelector';
import { DatabaseTableDisplay } from '../DatabaseTableDisplay';

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
      const gridRef = useRef(null);

      const rowData = [
        { make: 'Tesla', model: 'Model Y', price: 64950, electric: true },
        { make: 'Ford', model: 'F-Series', price: 33850, electric: false },
        { make: 'Toyota', model: 'Corolla', price: 29600, electric: false },
      ];

      // Column Definitions: Defines the columns to be displayed.
      const colDefs: ColDef[] = [
        { field: 'make', unSortIcon: true, sort: 'desc' },
        {
          field: 'model',
          unSortIcon: true,
        },
        { field: 'price', unSortIcon: true },
        { field: 'electric' },
      ];

      const defaultColDef = {
        flex: 1,
      };
      return (
        <Box
          $padding="1rem"
          $gap="0.625rem"
          style={{
            flexGrow: 1,
            flexDirection: 'row',
            height: '500px',
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
                <AgGridReact
                  ref={gridRef}
                  rowData={rowData}
                  columnDefs={colDefs}
                  defaultColDef={defaultColDef}
                />
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
