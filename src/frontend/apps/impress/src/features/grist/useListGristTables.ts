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
  documentId?: number,
): { tables: Table[] | null } => {
  const [tables, setTables] = useState<Table[] | null>(null);

  useEffect(() => {
    const fetchTables = async () => {
      if (!documentId) {
        console.warn('Document ID is required to fetch Grist tables');
        return;
      }
      const url = `docs/${documentId}/tables`;
      const response = await gristFetchApi(url);
      if (!response.ok) {
        throw new APIError(
          'Failed to fetch Grist tables',
          await errorCauses(response),
        );
      }
      return (await response.json()) as Promise<TableDescription>;
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
