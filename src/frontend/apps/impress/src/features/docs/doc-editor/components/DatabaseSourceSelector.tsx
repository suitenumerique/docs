import { useState } from 'react';

import { Box, DropdownMenu, Text } from '@/components';
import { useListGristTables } from '@/features/grist';
import { Doc, useListGristDocs } from '@/features/grist/useListGristDocs';

type DatabaseSourceSelectorProps = {
  onSourceSelected: (args: { documentId: string; tableId: string }) => void;
};

export const DatabaseSourceSelector = ({
  onSourceSelected,
}: DatabaseSourceSelectorProps) => {
  const [selectedDoc, setSelectedDoc] = useState<Doc>();
  const { docs } = useListGristDocs();
  const { tables } = useListGristTables(selectedDoc?.id);

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
      {selectedDoc && tables && (
        <DropdownMenu
          options={tables.map(({ id }) => ({
            label: id,
            value: id,
            callback: () =>
              onSourceSelected({ documentId: selectedDoc.id, tableId: id }),
          }))}
          showArrow
        >
          <Text>Sélectionner une table Grist existante</Text>
        </DropdownMenu>
      )}
    </Box>
  );
};
