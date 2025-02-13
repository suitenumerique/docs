import { APIError, errorCauses } from '@/api';

interface PollOutgoingMessageParams {
  pollUrl: string;
  message64: string;
}
interface PollOutgoingMessageResponse {
  updated?: boolean;
}

export const pollOutgoingMessageRequest = async ({
  pollUrl,
  message64,
}: PollOutgoingMessageParams): Promise<PollOutgoingMessageResponse> => {
  const response = await fetch(pollUrl, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message64,
    }),
  });

  if (!response.ok) {
    throw new APIError(
      `Post poll message request failed`,
      await errorCauses(response),
    );
  }

  return response.json() as Promise<PollOutgoingMessageResponse>;
};

interface PollSyncParams {
  pollUrl: string;
  localDoc64: string;
}
interface PollSyncResponse {
  syncDoc64?: string;
}

export const postPollSyncRequest = async ({
  pollUrl,
  localDoc64,
}: PollSyncParams): Promise<PollSyncResponse> => {
  const response = await fetch(pollUrl, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      localDoc64,
    }),
  });

  if (!response.ok) {
    throw new APIError(
      `Sync request failed: ${response.status} ${response.statusText}`,
      await errorCauses(response),
    );
  }

  return response.json() as Promise<PollSyncResponse>;
};
