import {
  UseMutationOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { KEY_DOC, KEY_LIST_DOC } from '@/features/docs/doc-management';
import { KEY_LIST_USER } from '@/features/docs/doc-share';
import { useBroadcastStore } from '@/stores';

import { KEY_LIST_DOC_ACCESSES } from './useDocAccesses';

interface DeleteDocAccessProps {
  docId: string;
  accessId: string;
}

export const deleteDocAccess = async ({
  docId,
  accessId,
}: DeleteDocAccessProps): Promise<void> => {
  const response = await fetchAPI(`documents/${docId}/accesses/${accessId}/`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new APIError(
      'Failed to delete the member',
      await errorCauses(response),
    );
  }
};

type UseDeleteDocAccessOptions = UseMutationOptions<
  void,
  APIError,
  DeleteDocAccessProps
>;

export const useDeleteDocAccess = (options?: UseDeleteDocAccessOptions) => {
  const queryClient = useQueryClient();
  const { broadcast } = useBroadcastStore();

  return useMutation<void, APIError, DeleteDocAccessProps>({
    mutationFn: deleteDocAccess,
    ...options,
    onSuccess: (data, variables, context) => {
      void queryClient.invalidateQueries({
        queryKey: [KEY_LIST_DOC_ACCESSES],
      });
      void queryClient.invalidateQueries({
        queryKey: [KEY_DOC],
      });

      // Broadcast to every user connected to the document
      broadcast(`${KEY_DOC}-${variables.docId}`);

      void queryClient.resetQueries({
        queryKey: [KEY_LIST_DOC],
      });
      void queryClient.invalidateQueries({
        queryKey: [KEY_LIST_USER],
      });
      if (options?.onSuccess) {
        options.onSuccess(data, variables, context);
      }
    },
    onError: (error, variables, context) => {
      if (options?.onError) {
        options.onError(error, variables, context);
      }
    },
  });
};
