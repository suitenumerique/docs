import { APIError, errorCauses } from '@/api';

import { Base64 } from '../types';

interface SyncDocPollingParams {
  pollUrl: string;
  yDoc64: Base64;
}

interface SyncDocPollingResponse {
  yDoc64?: Base64;
}

export const syncDocPolling = async ({
  pollUrl,
  yDoc64,
}: SyncDocPollingParams): Promise<SyncDocPollingResponse> => {
  const response = await fetch(pollUrl, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      yDoc64,
    }),
  });

  if (!response.ok) {
    throw new APIError('Failed to sync the doc', await errorCauses(response));
  }

  return response.json() as Promise<SyncDocPollingResponse>;
};
