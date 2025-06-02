import { useEffect, useState } from 'react';

import { APIError, errorCauses, gristFetchApi } from '@/api';

export type UseGristTableArguments = { documentId?: string; tableId?: string };

export const useGristTable = ({
  documentId,
  tableId,
}: UseGristTableArguments) => {
  const [tableData, setTableData] = useState<unknown[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const url = `docs/${documentId}/tables/${tableId}/table`;
      const response = await gristFetchApi(url);
      if (!response.ok) {
        throw new APIError(
          'Failed to request ai transform',
          await errorCauses(response),
        );
      }
      return (await response.json()) as Promise<unknown[]>;
    };

    const createDocument = async (workspaceId: string) => {
      const url = `workspaces/${workspaceId}/docs`;
      const response = await gristFetchApi(url, {
        method: 'POST',
        body: JSON.stringify({ name: 'New Doc' }),
      });
      if (!response.ok) {
        throw new APIError(
          'Failed to create Grist document',
          await errorCauses(response),
        );
      }
      return (await response.json()) as Promise<string>;
    };

    const createTable = async (documentId: string) => {
      const url = `docs/${documentId}/tables`;
      const response = await gristFetchApi(url, {
        method: 'POST',
        body: JSON.stringify({
          tables: [{ id: 'New Table', columns: [] }],
        }),
      });
      if (!response.ok) {
        throw new APIError(
          'Failed to create Grist table',
          await errorCauses(response),
        );
      }
      return (await response.json()) as Promise<string>;
    };

    if (!documentId) {
      const DEFAULT_WORKSPACE_ID = '2';
      createDocument(DEFAULT_WORKSPACE_ID)
        .then((newDocumentId) => {
          createTable(newDocumentId)
            .then((newTableId) => {
              console.log(
                `Created new Grist document with ID: ${newDocumentId} and table ID: ${newTableId}`,
              );
            })
            .catch((error) => {
              console.error('Error creating Grist table:', error);
            });
        })
        .catch((error) => {
          console.error('Error creating Grist document:', error);
        });
    }

    if (!tableId) {
      createTable(documentId ?? '')
        .then((newTableId) => {
          console.log(`Created new Grist table with ID: ${newTableId}`);
        })
        .catch((error) => {
          console.error('Error creating Grist table:', error);
        });
    }

    fetchData()
      .then((res) => {
        setTableData(res);
      })
      .catch((error) => {
        console.error('Error fetching Grist table data:', error);
      });
  }, [documentId, tableId]);
  return {
    tableData,
  };
};
