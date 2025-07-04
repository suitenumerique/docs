import {
  UseMutationOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { Doc } from '@/docs/doc-management';

import { KEY_CAN_EDIT } from './useDocCanEdit';

export type UpdateDocParams = Pick<Doc, 'id'> &
  Partial<Pick<Doc, 'content' | 'title'>> & {
    websocket?: boolean;
  };

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

type UseUpdateDoc = UseMutationOptions<Doc, APIError, Partial<Doc>> & {
  listInvalideQueries?: string[];
};

export function useUpdateDoc(queryConfig?: UseUpdateDoc) {
  const queryClient = useQueryClient();
  return useMutation<Doc, APIError, UpdateDocParams>({
    mutationFn: updateDoc,
    ...queryConfig,
    onSuccess: (data, variables, context) => {
      queryConfig?.listInvalideQueries?.forEach((queryKey) => {
        void queryClient.invalidateQueries({
          queryKey: [queryKey],
        });
      });

      if (queryConfig?.onSuccess) {
        void queryConfig.onSuccess(data, variables, context);
      }
    },
    onError: () => {
      void queryClient.invalidateQueries({
        queryKey: [KEY_CAN_EDIT],
      });
    },
  });
}
