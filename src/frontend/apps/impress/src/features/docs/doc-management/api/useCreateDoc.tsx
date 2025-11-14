import { useMutation, useQueryClient } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

import { Doc } from '../types';

import { KEY_LIST_DOC } from './useDocs';

type CreateDocParams = {
  title?: string;
} | void;

export const createDoc = async (params: CreateDocParams): Promise<Doc> => {
  const response = await fetchAPI(`documents/`, {
    method: 'POST',
    body: JSON.stringify({ title: params?.title }),
  });

  if (!response.ok) {
    throw new APIError('Failed to create the doc', await errorCauses(response));
  }

  return response.json() as Promise<Doc>;
};

interface CreateDocProps {
  onSuccess: (data: Doc) => void;
  onError?: (error: APIError) => void;
}

export function useCreateDoc({ onSuccess, onError }: CreateDocProps) {
  const queryClient = useQueryClient();
  return useMutation<Doc, APIError, CreateDocParams>({
    mutationFn: createDoc,
    onSuccess: (data) => {
      void queryClient.resetQueries({
        queryKey: [KEY_LIST_DOC],
      });
      onSuccess(data);
    },
    onError: (error) => {
      onError?.(error);
    },
  });
}
