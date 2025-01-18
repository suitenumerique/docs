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

// interface PollParams {
//   pollUrl: string;
//   timeout: number;
// }
// export const longPollRequest = async <Response>({
//   pollUrl,
//   timeout,
// }: PollParams): Promise<Response> => {
//   try {
//     const controller = new AbortController();
//     const timeoutId = setTimeout(
//       () => controller.abort('Request Timeout'),
//       timeout,
//     );

//     const response = await fetch(pollUrl, {
//       method: 'GET',
//       credentials: 'include',
//       headers: {
//         'Content-Type': 'application/json',
//       },
//       signal: controller.signal,
//     });

//     clearTimeout(timeoutId);

//     if (!response.ok) {
//       throw new APIError(
//         `Long polling request failed: ${response.status} ${response.statusText}`,
//         await errorCauses(response),
//       );
//     }

//     return response.json() as Promise<Response>;
//   } catch (error) {
//     if (error instanceof Error && error.name === 'AbortError') {
//       console.error('Polling request timed out');
//     }
//     throw error;
//   }
// };

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

interface CollaborationSSEParams {
  pollUrl: string;
}
// interface PollSyncResponse {
//   syncDoc64?: string;
// }

export function collaborationSSE({ pollUrl }: CollaborationSSEParams) {
  // Create an EventSource instance pointing to your SSE endpoint
  const eventSource = new EventSource(pollUrl, { withCredentials: true });

  // 1. onmessage handles messages sent with `data:` lines
  eventSource.onmessage = (event) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument
    const data = JSON.parse(event.data);
    console.log('Received SSE event:', data);
    // Update your UI or state based on `data`
  };

  // 2. onopen is triggered when the connection is first established
  eventSource.onopen = () => {
    console.log('SSE connection opened.');
  };

  // 3. onerror is triggered if there's a connection issue
  eventSource.onerror = (err) => {
    console.error('SSE error:', err);
    // Depending on the error, the browser may or may not automatically reconnect
  };

  // Optionally return the eventSource if you need to close it manually later
  return eventSource;
}
