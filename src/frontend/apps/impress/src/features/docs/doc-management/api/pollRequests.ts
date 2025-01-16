import { APIError, errorCauses } from '@/api';

interface PostPollMessageParams {
  pollUrl: string;
  message64: string;
}
interface PostPollMessageResponse {
  updated?: boolean;
}

export const postPollMessageRequest = async ({
  pollUrl,
  message64,
}: PostPollMessageParams): Promise<PostPollMessageResponse> => {
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

  return response.json() as Promise<PostPollMessageResponse>;
};

interface PollParams {
  pollUrl: string;
  timeout: number;
}
export const longPollRequest = async <Response>({
  pollUrl,
  timeout,
}: PollParams): Promise<Response> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort('Request Timeout'),
      timeout,
    );

    const response = await fetch(pollUrl, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new APIError(
        `Long polling request failed: ${response.status} ${response.statusText}`,
        await errorCauses(response),
      );
    }

    return response.json() as Promise<Response>;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('Polling request timed out');
    }
    throw error;
  }
};

interface PollSyncParams {
  pollUrl: string;
  localDoc64: string;
}
interface PollSyncResponse {
  syncDoc64?: string;
}

export const pollSyncRequest = async ({
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
