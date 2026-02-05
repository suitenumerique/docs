import { APIError, errorCauses } from '@/api';
import { sleep } from '@/utils';
import { isSafeUrl } from '@/utils/url';

import { ANALYZE_URL } from '../conf';

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
  if (!isSafeUrl(urlMedia) || !urlMedia.includes(ANALYZE_URL)) {
    throw new APIError('Url invalid', { status: 400 });
  }

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

/**
 * Upload file can be analyzed on the server side,
 * we had this function to wait for the analysis to be done
 * before returning the file url. It will keep the loader
 * on the upload button until the analysis is done.
 * @param url
 * @returns Promise<CheckDocMediaStatusResponse> status_code
 * @description Waits for the upload to be analyzed by checking the status of the file.
 */
export const loopCheckDocMediaStatus = async (
  url: string,
): Promise<CheckDocMediaStatusResponse> => {
  const SLEEP_TIME = 5000;
  const response = await checkDocMediaStatus({
    urlMedia: url,
  });

  if (response.status === 'ready') {
    return response;
  } else {
    await sleep(SLEEP_TIME);
    return await loopCheckDocMediaStatus(url);
  }
};
