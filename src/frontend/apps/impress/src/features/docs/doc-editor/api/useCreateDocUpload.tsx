import { useMutation } from '@tanstack/react-query';
import { t } from 'i18next';

import { APIError, errorCauses, fetchAPI } from '@/api';

import { DocAttachment } from '../types';

interface CreateDocAttachment {
  docId: string;
  body: FormData;
}

export const createDocAttachment = async ({
  docId,
  body,
}: CreateDocAttachment): Promise<DocAttachment> => {
  const response = await fetchAPI(`documents/${docId}/attachment-upload/`, {
    method: 'POST',
    body,
    withoutContentType: true,
  });

  if (!response.ok) {
    const causes = await errorCauses(response);

    // A proxy sitting in front of the API can enforce a lower limit than the application
    // does, and answers a 413 with an HTML body carrying no usable cause.
    if (response.status === 413 && !causes.cause?.length) {
      causes.cause = [t('This file is too large to be uploaded.')];
    }

    throw new APIError('Failed to upload on the doc', causes);
  }

  return response.json() as Promise<DocAttachment>;
};

export function useCreateDocAttachment() {
  return useMutation<DocAttachment, APIError, CreateDocAttachment>({
    mutationFn: createDocAttachment,
  });
}
