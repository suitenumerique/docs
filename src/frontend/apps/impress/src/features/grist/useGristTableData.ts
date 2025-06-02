import { useEffect, useState } from 'react';

import { APIError, errorCauses, gristFetchApi } from '@/api';

export type UseGristTableDataArguments = {
  documentId: string;
  tableId: string;
};

export const useGristTableData = ({
  documentId,
  tableId,
}: UseGristTableDataArguments) => {
  const [tableData, setTableData] = useState<
    Record<string, (string | number | boolean)[]>
  >({});

  useEffect(() => {
    const fetchData = async () => {
      const url = `docs/${documentId}/tables/${tableId}/data`;
      const response = await gristFetchApi(url);
      if (!response.ok) {
        throw new APIError(
          'Failed to fetch Grist table data',
          await errorCauses(response),
        );
      }
      return (await response.json()) as Promise<unknown>;
    };

    fetchData()
      .then((res) => {
        setTableData(res as Record<string, (string | number | boolean)[]>);
      })
      .catch((error) => {
        console.error('Error fetching Grist table data:', error);
      });
  }, [documentId, tableId]);
  return {
    tableData,
  };
};
