import { gristFetchApi } from '@/api';

export const useGristCrudRecords = () => {
  const createRecords = async (
    documentId: string,
    tableId: string,
    records: { fields: unknown }[],
  ) => {
    const url = `docs/${documentId}/tables/${tableId}/records`;
    try {
      const response = await gristFetchApi(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ records }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `Failed to create record: ${response.status} ${response.statusText} - ${errorBody}`,
        );
      }

      return (await response.json()) as Promise<{ records: { id: string }[] }>;
    } catch (error) {
      console.error('Error creating Grist record:', error);
      throw error;
    }
  };

  const deleteRecords = async (
    documentId: string,
    tableId: string,
    recordIds: number[],
  ) => {
    const url = `docs/${documentId}/tables/${tableId}/data/delete`;
    try {
      const response = await gristFetchApi(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(recordIds),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `Failed to delete records: ${response.status} ${response.statusText} - ${errorBody}`,
        );
      }
    } catch (error) {
      console.error('Error deleting Grist records:', error);
      throw error;
    }
  };

  const updateRecords = async (
    documentId: string,
    tableId: string,
    records: { id: number; fields: unknown }[],
  ) => {
    const url = `docs/${documentId}/tables/${tableId}/records`;
    try {
      const response = await gristFetchApi(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(records),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `Failed to update records: ${response.status} ${response.statusText} - ${errorBody}`,
        );
      }
    } catch (error) {
      console.error('Error updating Grist records:', error);
      throw error;
    }
  };

  return { createRecords, deleteRecords, updateRecords };
};
