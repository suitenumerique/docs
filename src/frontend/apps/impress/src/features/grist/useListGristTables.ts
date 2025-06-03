import { useQuery } from '@tanstack/react-query';

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

const listTables = async (documentId: number) => {
  const url = `docs/${documentId}/tables`;
  const response = await gristFetchApi(url);

  if (!response.ok) {
    throw new APIError(
      'Failed to fetch Grist tables',
      await errorCauses(response),
    );
  }

  const tableDescription = (await response.json()) as TableDescription;
  return tableDescription.tables;
};

type UseListGristTablesReturnType = {
  tables: Table[] | undefined;
  isLoading: boolean;
};

export const useListGristTables = (
  documentId: number,
): UseListGristTablesReturnType => {
  const { data: tables, isLoading } = useQuery<Table[]>({
    queryKey: ['listTables', documentId],
    queryFn: () => listTables(documentId),
  });

  return {
    tables,
    isLoading,
  };
};
