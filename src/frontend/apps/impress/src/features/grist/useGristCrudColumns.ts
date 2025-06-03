import { gristFetchApi } from '@/api';

export const useGristCrudColumns = () => {
  const createColumns = async (
    documentId: string,
    tableId: string,
    columns: { id: string; fields: unknown }[],
  ) => {
    const url = `docs/${documentId}/tables/${tableId}/columns`;
    try {
      const response = await gristFetchApi(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(columns),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `Failed to create columns: ${response.status} ${response.statusText} - ${errorBody}`,
        );
      }

      return (await response.json()) as Promise<{ records: { id: string }[] }>;
    } catch (error) {
      console.error('Error creating Grist record:', error);
      throw error;
    }
  };

  const deleteColumns = async (
    documentId: string,
    tableId: string,
    columnId: string,
  ) => {
    const url = `docs/${documentId}/tables/${tableId}/columns/${columnId}`;
    try {
      const response = await gristFetchApi(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `Failed to delete column: ${response.status} ${response.statusText} - ${errorBody}`,
        );
      }
    } catch (error) {
      console.error('Error deleting Grist column:', error);
      throw error;
    }
  };

  return { createColumns, deleteColumns };
};
