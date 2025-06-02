/* eslint-disable react-hooks/rules-of-hooks */
import { defaultProps, insertOrUpdateBlock } from '@blocknote/core';
import { BlockTypeSelectItem, createReactBlockSpec } from '@blocknote/react';
import { Button, Input } from '@openfun/cunningham-react';
import { ColDef } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { TFunction } from 'i18next';
import React, { useRef, useState } from 'react';

import { Box, DropButton, Icon, Text } from '@/components';

import { DocsBlockNoteEditor } from '../../types';
import { DatabaseSourceSelector } from '../DatabaseSourceSelector';
import { DatabaseTableDisplay } from '../DatabaseTableDisplay';

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
      const [addColumnToggleOpen, setAddColumnToggleOpen] = useState(false);

      const gridRef = useRef(null);

      const [rowData, setRowData] = useState([
        { make: 'Tesla', model: 'Model Y', price: 64950, electric: true },
        { make: 'Ford', model: 'F-Series', price: 33850, electric: false },
        { make: 'Toyota', model: 'Corolla', price: 29600, electric: false },
      ]);

      const AddButtonComponent = ({
        isOpen,
        setIsOpen,
      }: {
        isOpen: boolean;
        setIsOpen: (open: boolean) => void;
      }) => {
        const onOpenChange = (isOpen: boolean) => {
          setIsOpen(isOpen);
        };

        return (
          <DropButton
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            label="add column"
            button={
              <Box style={{ padding: '0.25rem', gap: '16px' }} color="tertiary">
                <span className="material-icons">add</span>
              </Box>
            }
          >
            <Box style={{ padding: '10px', gap: '10px' }}>
              <Text
                $variation="600"
                $size="s"
                $weight="bold"
                $theme="greyscale"
              >
                Ajouter une colonne
              </Text>
              <Input label="Column label"></Input>
              <Button
                size="small"
                onClick={() => {
                  setIsOpen(false);
                  console.log('Column added', addColumnToggleOpen);
                }}
                style={{ alignSelf: 'end', width: 'fit-content' }}
              >
                Valider
              </Button>
            </Box>
          </DropButton>
        );
      };

      // Column Definitions: Defines the columns to be displayed.
      const [colDefs, setColDefs] = useState<ColDef[]>([
        { field: 'make', sort: 'desc' },
        {
          field: 'model',
          filter: true,
        },
        { field: 'price', filter: true },
        { field: 'electric' },
        {
          headerComponentParams: {
            innerHeaderComponent: () =>
              AddButtonComponent({
                isOpen: addColumnToggleOpen,
                setIsOpen: setAddColumnToggleOpen,
              }),
          },
          unSortIcon: false,
          editable: false,
          sortable: false,
          spanRows: true,
        },
      ]);

      const defaultColDef = {
        flex: 1,
        editable: true,
        unSortIcon: true,
      };
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
                <AgGridReact
                  ref={gridRef}
                  rowData={rowData}
                  columnDefs={colDefs}
                  defaultColDef={defaultColDef}
                  domLayout="autoHeight"
                  enableCellSpan={true}
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
