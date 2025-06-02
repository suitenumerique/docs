import { useState } from 'react';

import { Box, DropdownMenu, Text } from '@/components';
import { useListGristTables } from '@/features/grist';
import { Doc, useListGristDocs } from '@/features/grist/useListGristDocs';

type DatabaseSourceSelectorProps = {
  onSourceSelected: (args: { documentId: number; tableId: string }) => void;
};

const TableSelector = ({
  documentId,
  onSourceSelected,
}: { documentId: number } & DatabaseSourceSelectorProps) => {
  const { tables } = useListGristTables(documentId);
  return tables ? (
    <DropdownMenu
      options={tables.map(({ id }) => ({
        label: id,
        value: id,
        callback: () => onSourceSelected({ documentId, tableId: id }),
      }))}
      showArrow
    >
      <Text>Sélectionner une table Grist existante</Text>
    </DropdownMenu>
  ) : (
    <Box>
      <Text>No tables available</Text>
    </Box>
  );
};

export const DatabaseSourceSelector = ({
  onSourceSelected,
}: DatabaseSourceSelectorProps) => {
  const [selectedDoc, setSelectedDoc] = useState<Doc>();
  const { docs } = useListGristDocs();

  return (
    <Box>
      <DropdownMenu
        options={docs.map((doc) => ({
          label: doc.name,
          value: doc.id,
          callback: () => setSelectedDoc(doc),
        }))}
        showArrow
      >
        <Text>{selectedDoc?.name ?? 'Sélectionner un document Grist'}</Text>
      </DropdownMenu>
      {selectedDoc && (
        <TableSelector
          documentId={selectedDoc.id}
          onSourceSelected={onSourceSelected}
        />
      )}
    </Box>
  );
};
