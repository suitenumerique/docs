import React from 'react';

import { Box, Text } from '@/components';
import { Button } from '@openfun/cunningham-react';
import { DatabaseSourceSelector } from '@/docs/doc-editor/components/DatabaseSourceSelector';

type DatabaseSelectorProps = {
  onDatabaseSelected: (args: { documentId: string; tableId: string }) => void;
};

export const DatabaseSelector = ({
  onDatabaseSelected,
}: DatabaseSelectorProps) => (
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
    <DatabaseSourceSelector onSourceSelected={onDatabaseSelected} />
  </Box>
);
