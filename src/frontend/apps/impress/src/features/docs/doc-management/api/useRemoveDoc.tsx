import {
  UseMutationOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

import { KEY_LIST_DOC } from './useDocs';

interface RemoveDocProps {
  docId: string;
}

export const removeDoc = async ({ docId }: RemoveDocProps): Promise<void> => {
  const response = await fetchAPI(`documents/${docId}/`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new APIError('Failed to delete the doc', await errorCauses(response));
  }
};

type UseRemoveDocOptions = UseMutationOptions<void, APIError, RemoveDocProps>;

export const useRemoveDoc = (options?: UseRemoveDocOptions) => {
  const queryClient = useQueryClient();
  return useMutation<void, APIError, RemoveDocProps>({
    mutationFn: removeDoc,
    ...options,
    onSuccess: (data, variables, context) => {
      void queryClient.invalidateQueries({
        queryKey: [KEY_LIST_DOC],
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
