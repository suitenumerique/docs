import { APIError, errorCauses, gristFetchApi } from '@/api';

import { TableDescription } from './useListGristTables';

export const useGristCreateDocAndTable = () => {
  const createTable = async (
    name: string,
  ): Promise<{
    documentId: string;
    tableId: string;
  }> => {
    const DEFAULT_WORKSPACE_ID = 2;
    const docUrl = `workspaces/${DEFAULT_WORKSPACE_ID}/docs`;
    try {
      const docResponse = await gristFetchApi(docUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });

      if (!docResponse.ok) {
        throw new APIError(
          'Failed to fetch Grist tables',
          await errorCauses(docResponse),
        );
      }

      const documentId = (await docResponse.json()) as string;

      const tableUrl = `docs/${documentId}/tables`;
      const tableResponse = await gristFetchApi(tableUrl);
      if (!tableResponse.ok) {
        throw new APIError(
          'Failed to fetch Grist tables',
          await errorCauses(tableResponse),
        );
      }

      const tableDescription = (await tableResponse.json()) as TableDescription;

      if (tableDescription.tables.length === 0) {
        throw new Error('No tables found in the created document');
      }

      if (tableDescription.tables.length > 1) {
        throw new Error(
          'More than one table has been found in the created document, this should not happen.',
        );
      }

      return {
        documentId,
        tableId: tableDescription.tables[0].id,
      };
    } catch (error) {
      console.error('Error creating Grist table:', error);
      throw error;
    }
  };

  return { createTable };
};
