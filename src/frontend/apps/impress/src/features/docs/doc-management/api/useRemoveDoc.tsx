import {
  UseMutationOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

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

export const useRemoveDoc = ({
  listInvalidQueries,
  options,
}: {
  listInvalidQueries?: string[];
  options?: UseRemoveDocOptions;
}) => {
  const queryClient = useQueryClient();
  return useMutation<void, APIError, RemoveDocProps>({
    mutationFn: removeDoc,
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      listInvalidQueries?.forEach((queryKey) => {
        void queryClient.invalidateQueries({
          queryKey: [queryKey],
        });
      });
      if (options?.onSuccess) {
        void options.onSuccess(data, variables, onMutateResult, context);
      }
    },
    onError: (error, variables, onMutateResult, context) => {
      if (options?.onError) {
        void options.onError(error, variables, onMutateResult, context);
      }
    },
  });
};
