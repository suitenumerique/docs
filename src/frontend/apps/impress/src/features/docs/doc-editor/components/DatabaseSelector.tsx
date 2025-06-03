import { Button } from '@openfun/cunningham-react';
import React from 'react';

import { Box, Text } from '@/components';
import { DatabaseSourceSelector } from '@/docs/doc-editor/components/DatabaseSourceSelector';
import { useGristCreateDocAndTable } from '@/features/grist/useGristCreateTable';
import { useDocStore } from '../../doc-management';

type DatabaseSelectorProps = {
  onDatabaseSelected: (params: { documentId: string; tableId: string }) => void;
};

export const DatabaseSelector = ({
  onDatabaseSelected,
}: DatabaseSelectorProps) => {
  const { createTable } = useGristCreateDocAndTable();
  const { currentDoc } = useDocStore();

  const handleCreateNewDatabase = () => {
    if (!currentDoc) {
      console.error('No current document found to create a new database.');
      return;
    }
    createTable(currentDoc.title ?? currentDoc.id)
      .then(({ documentId, tableId }) => {
        onDatabaseSelected({ documentId, tableId });
      })
      .catch((error) => {
        console.error('Error creating new database:', error);
      });
  };

  return (
    <Box
      style={{
        flexDirection: 'column',
        gap: 10,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
      }}
    >
      <Button onClick={handleCreateNewDatabase}>
        Créer une nouvelle base de données vide
      </Button>
      <Text>ou</Text>
      <DatabaseSourceSelector onSourceSelected={onDatabaseSelected} />
    </Box>
  );
};
