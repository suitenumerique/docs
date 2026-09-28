import { APIError, errorCauses } from '@/api';
import { isSafeUrl } from '@/utils/url';

import { ANALYZE_URL } from '../conf';

interface CheckDocMediaStatusResponse {
  file?: string;
  status: 'processing' | 'ready';
}

interface CheckDocMediaStatus {
  urlMedia: string;
  signal?: AbortSignal;
}

export const checkDocMediaStatus = async ({
  urlMedia,
  signal,
}: CheckDocMediaStatus): Promise<CheckDocMediaStatusResponse> => {
  if (!isSafeUrl(urlMedia) || !urlMedia.includes(ANALYZE_URL)) {
    throw new APIError('Url invalid', { status: 400 });
  }

  const response = await fetch(urlMedia, {
    credentials: 'include',
    signal,
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
 * A sleep function that can be aborted using an AbortSignal.
 * If the signal is aborted, the promise will reject with an 'Aborted' error.
 * @param ms The number of milliseconds to sleep.
 * @param signal The AbortSignal to cancel the sleep.
 * @returns A promise that resolves after the specified time or rejects if aborted.
 */
const abortableSleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });

/**
 * Upload file can be analyzed on the server side,
 * we had this function to wait for the analysis to be done
 * before returning the file url. It will keep the loader
 * on the upload button until the analysis is done.
 * @param url
 * @param signal AbortSignal to cancel the loop (e.g. on component unmount)
 * @returns Promise<CheckDocMediaStatusResponse> status_code
 * @description Waits for the upload to be analyzed by checking the status of the file.
 */
export const loopCheckDocMediaStatus = async (
  url: string,
  signal: AbortSignal,
): Promise<CheckDocMediaStatusResponse> => {
  const SLEEP_TIME = 5000;

  /**
   * Check if the signal has been aborted before making the API call.
   * This prevents unnecessary API calls and allows for a faster response to cancellation.
   */
  if (signal.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const response = await checkDocMediaStatus({ urlMedia: url, signal });

  if (response.status === 'ready') {
    return response;
  }

  await abortableSleep(SLEEP_TIME, signal);
  return loopCheckDocMediaStatus(url, signal);
};
