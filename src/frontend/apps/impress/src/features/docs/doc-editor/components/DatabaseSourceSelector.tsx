import { Spinner } from '@gouvfr-lasuite/ui-kit';
import { Select } from '@openfun/cunningham-react';
import { useState } from 'react';

import { Box, Text } from '@/components';
import { useListGristTables } from '@/features/grist';
import { Doc, useListGristDocs } from '@/features/grist/useListGristDocs';

type DatabaseSourceSelectorProps = {
  onSourceSelected: (args: { documentId: string; tableId: string }) => void;
};

const TableSelector = ({
  documentId,
  onSourceSelected,
}: { documentId: number } & DatabaseSourceSelectorProps) => {
  const { tables, isLoading } = useListGristTables(documentId);
  if (tables) {
    return (
      <Select
        label="Sélectionner une table Grist existante"
        options={tables.map(({ id }) => ({
          label: id,
          value: id,
          render: () => <Text style={{ padding: 10 }}>{id}</Text>,
        }))}
        onChange={(e) => {
          // TODO: handle better :)
          // @ts-expect-error target value type not specified here
          onSourceSelected({ documentId, tableId: e.target.value });
        }}
      />
    );
  }
  if (isLoading) {
    return (
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
        <Spinner /> <Text>Chargement des tables...</Text>
      </Box>
    );
  }
  return (
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
    <Box style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
      <Select
        label={selectedDoc?.name ?? 'Sélectionner un document Grist'}
        options={docs.map((doc) => ({
          label: doc.name,
          value: doc.id.toString(),
          render: () => <Text style={{ padding: 10 }}>{doc.name}</Text>,
        }))}
        onChange={(e) =>
          setSelectedDoc(
            docs.find((doc) => doc.id.toString() === e.target.value),
          )
        }
      />
      {selectedDoc && (
        <TableSelector
          documentId={selectedDoc.id}
          onSourceSelected={onSourceSelected}
        />
      )}
    </Box>
  );
};
