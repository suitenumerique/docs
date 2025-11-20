import { useMutation, useQueryClient } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

import { Doc, KEY_LIST_DOC } from '../../doc-management';

export const importDoc = async (file: File): Promise<Doc> => {
  const form = new FormData();
  form.append('file', file);

  const response = await fetchAPI(`documents/`, {
    method: 'POST',
    body: form,
    withoutContentType: true,
  });

  if (!response.ok) {
    throw new APIError('Failed to import the doc', await errorCauses(response));
  }

  return response.json() as Promise<Doc>;
};

interface ImportDocProps {
  onSuccess?: (data: Doc) => void;
  onError?: (error: APIError) => void;
}

export function useImportDoc({ onSuccess, onError }: ImportDocProps) {
  const queryClient = useQueryClient();
  return useMutation<Doc, APIError, File>({
    mutationFn: importDoc,
    onSuccess: (data) => {
      void queryClient.resetQueries({
        queryKey: [KEY_LIST_DOC],
      });
      onSuccess?.(data);
    },
    onError: (error) => {
      onError?.(error);
    },
  });
}
