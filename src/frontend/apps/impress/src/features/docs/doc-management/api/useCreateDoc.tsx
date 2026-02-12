import {
  UseMutationOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

import { Doc } from '../types';

import { KEY_LIST_DOC } from './useDocs';

type CreateDocParams = {
  title?: string;
  isEncrypted?: boolean;
} | void;

export const createDoc = async (params: CreateDocParams): Promise<Doc> => {
  const response = await fetchAPI(`documents/`, {
    method: 'POST',
    body: JSON.stringify({
      title: params?.title,
      is_encrypted: params?.isEncrypted ?? false,
    }),
  });

  if (!response.ok) {
    throw new APIError('Failed to create the doc', await errorCauses(response));
  }

  return response.json() as Promise<Doc>;
};

type UseCreateDocOptions = UseMutationOptions<Doc, APIError, CreateDocParams>;

export function useCreateDoc(options?: UseCreateDocOptions) {
  const queryClient = useQueryClient();
  return useMutation<Doc, APIError, CreateDocParams>({
    mutationFn: createDoc,
    onSuccess: (data, variables, onMutateResult, context) => {
      void queryClient.resetQueries({
        queryKey: [KEY_LIST_DOC],
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
