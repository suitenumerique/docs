import { useEffect, useState } from 'react';

import { APIError, errorCauses, gristFetchApi } from '@/api';

export interface TableDescription {
  tables: Table[];
}

export interface Table {
  id: string;
  fields: Fields;
}

export interface Fields {
  tableRef: number;
  onDemand: boolean;
}

export const useListGristTables = (
  documentId: number,
): { tables: Table[] | undefined } => {
  const [tables, setTables] = useState<Table[]>();

  useEffect(() => {
    const fetchTables = async () => {
      const url = `docs/${documentId}/tables`;
      const response = await gristFetchApi(url);
      if (!response.ok) {
        throw new APIError(
          'Failed to fetch Grist tables',
          await errorCauses(response),
        );
      }
      return (await response.json()) as Promise<TableDescription>; // Adjusted to return an array of Table objects
    };

    fetchTables()
      .then((response) => {
        if (response) {
          setTables(response.tables);
        }
      })
      .catch((error) => {
        console.error('Error fetching Grist documents:', error);
      });
  }, [documentId]);

  return {
    tables,
  };
};
