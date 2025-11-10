import { useMutation } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

interface CreateExportParams {
  templateId: string;
  body: string;
  body_type: 'html' | 'markdown';
  format: 'pdf' | 'docx';
}

export const createExport = async ({
  templateId,
  body,
  body_type,
  format,
}: CreateExportParams): Promise<Blob> => {
  const response = await fetchAPI(
    `templates/${templateId}/generate-document/`,
    {
      method: 'POST',
      body: JSON.stringify({
        body,
        body_type,
        format,
      }),
    },
  );

  if (!response.ok) {
    throw new APIError(
      'Failed to export the document',
      await errorCauses(response),
    );
  }

  return await response.blob();
};

export function useExport() {
  return useMutation<Blob, APIError, CreateExportParams>({
    mutationFn: createExport,
  });
}
