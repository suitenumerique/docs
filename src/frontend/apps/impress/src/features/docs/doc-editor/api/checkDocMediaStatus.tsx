import { APIError, errorCauses } from '@/api';

interface CheckDocMediaStatusResponse {
  file?: string;
  status: 'processing' | 'ready';
}

interface CheckDocMediaStatus {
  urlMedia: string;
}

export const checkDocMediaStatus = async ({
  urlMedia,
}: CheckDocMediaStatus): Promise<CheckDocMediaStatusResponse> => {
  const response = await fetch(urlMedia, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new APIError(
      'Failed to check the media status',
      await errorCauses(response),
    );
  }

  return response.json() as Promise<CheckDocMediaStatusResponse>;
};
