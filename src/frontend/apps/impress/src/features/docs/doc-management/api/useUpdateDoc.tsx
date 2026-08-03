import {
  UseMutationOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

import { useProviderStore } from '../stores';
import { Doc } from '../types';

export interface UpdateDocParams {
  id: Doc['id'];
  title?: string;
  websocket?: boolean;
}

export const updateDoc = async ({
  id,
  ...params
}: UpdateDocParams): Promise<Doc> => {
  const response = await fetchAPI(`documents/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...params,
    }),
  });

  if (!response.ok) {
    throw new APIError('Failed to update the doc', await errorCauses(response));
  }

  return response.json() as Promise<Doc>;
};

type UseUpdateDoc = UseMutationOptions<Doc, APIError, UpdateDocParams> & {
  listInvalidQueries?: string[];
};

export function useUpdateDoc(queryConfig?: UseUpdateDoc) {
  const queryClient = useQueryClient();
  return useMutation<Doc, APIError, UpdateDocParams>({
    /**
     * Tell the backend when we hold a live collaboration connection,
     * otherwise its no-websocket cache lock blocks the update while
     * another user is connected.
     */
    mutationFn: (params) =>
      updateDoc({
        ...(useProviderStore.getState().isSynced ? { websocket: true } : {}),
        ...params,
      }),
    ...queryConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryConfig?.listInvalidQueries?.forEach((queryKey) => {
        void queryClient.resetQueries({
          queryKey: [queryKey],
        });
      });

      if (queryConfig?.onSuccess) {
        void queryConfig.onSuccess(data, variables, onMutateResult, context);
      }
    },
    onError: (error, variables, onMutateResult, context) => {
      if (queryConfig?.onError) {
        queryConfig.onError(error, variables, onMutateResult, context);
      }
    },
  });
}
