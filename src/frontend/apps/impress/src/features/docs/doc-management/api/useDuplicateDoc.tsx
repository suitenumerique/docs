import {
  UseMutationOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

import { Doc } from '../types';

import { KEY_LIST_DOC } from './useDocs';

interface DuplicateDocPayload {
  docId: string;
  with_accesses?: boolean;
}

type DuplicateDocResponse = Pick<Doc, 'id'>;

export const duplicateDoc = async ({
  docId,
  with_accesses,
}: DuplicateDocPayload): Promise<DuplicateDocResponse> => {
  const response = await fetchAPI(`documents/${docId}/duplicate/`, {
    method: 'POST',
    body: JSON.stringify({ with_accesses }),
  });

  if (!response.ok) {
    throw new APIError(
      'Failed to duplicate the doc',
      await errorCauses(response),
    );
  }

  return response.json() as Promise<DuplicateDocResponse>;
};

type DuplicateDocOptions = UseMutationOptions<
  DuplicateDocResponse,
  APIError,
  DuplicateDocPayload
>;

export function useDuplicateDoc(options: DuplicateDocOptions) {
  const queryClient = useQueryClient();
  return useMutation<DuplicateDocResponse, APIError, DuplicateDocPayload>({
    mutationFn: duplicateDoc,
    onSuccess: (data, variables, context) => {
      void queryClient.resetQueries({
        queryKey: [KEY_LIST_DOC],
      });
      void options.onSuccess?.(data, variables, context);
    },
  });
}
