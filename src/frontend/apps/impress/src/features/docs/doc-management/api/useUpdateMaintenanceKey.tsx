import { APIError, errorCauses, fetchAPI } from '@/api';
import { toBase64 } from '@/utils/string';

/**
 * Store the maintenance escrow copy of a document that has none (the
 * backfill). The copy a share returns is never sent: a share changes neither
 * the document key nor its owner, and the backend refuses a copy for the key
 * the stored one is already for.
 */
export const updateMaintenanceKey = async ({
  docId,
  maintenanceKey,
}: {
  docId: string;
  maintenanceKey: ArrayBuffer;
}): Promise<void> => {
  const response = await fetchAPI(`documents/${docId}/maintenance-key/`, {
    method: 'PATCH',
    body: JSON.stringify({
      maintenanceKey: toBase64(new Uint8Array(maintenanceKey)),
    }),
  });

  if (!response.ok) {
    throw new APIError(
      'Failed to store the maintenance key',
      await errorCauses(response),
    );
  }
};
