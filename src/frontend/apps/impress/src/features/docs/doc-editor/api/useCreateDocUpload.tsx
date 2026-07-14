import { useMutation } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

import { DocAttachment } from '../types';

interface CreateDocAttachment {
  docId: string;
  body: FormData;
  maxSize?: number;
  errorTitle?: string;
  errorCause?: string;
}

export const createDocAttachment = async ({
  docId,
  body,
  maxSize,
  errorTitle,
  errorCause,
}: CreateDocAttachment): Promise<DocAttachment> => {
  if (maxSize !== undefined) {
    const file = body.get('file') as File | null;
    if (file && file.size > maxSize) {
      throw new APIError(errorTitle ?? 'File is too large', {
        status: 413,
        cause: errorCause ? [errorCause] : [],
      });
    }
  }

  const response = await fetchAPI(`documents/${docId}/attachment-upload/`, {
    method: 'POST',
    body,
    withoutContentType: true,
  });

  if (!response.ok) {
    throw new APIError(
      'Failed to upload on the doc',
      await errorCauses(response),
    );
  }

  return response.json() as Promise<DocAttachment>;
};

export function useCreateDocAttachment() {
  return useMutation<DocAttachment, APIError, CreateDocAttachment>({
    mutationFn: createDocAttachment,
  });
}
