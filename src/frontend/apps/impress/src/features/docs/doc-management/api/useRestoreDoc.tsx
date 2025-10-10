import {
  UseMutationOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

interface RestoreDocProps {
  docId: string;
}

export const restoreDoc = async ({ docId }: RestoreDocProps): Promise<void> => {
  const response = await fetchAPI(`documents/${docId}/restore/`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new APIError(
      'Failed to restore the doc',
      await errorCauses(response),
    );
  }
};

type UseRestoreDocOptions = UseMutationOptions<void, APIError, RestoreDocProps>;

export const useRestoreDoc = ({
  listInvalidQueries,
  options,
}: {
  listInvalidQueries?: string[];
  options?: UseRestoreDocOptions;
}) => {
  const queryClient = useQueryClient();
  return useMutation<void, APIError, RestoreDocProps>({
    mutationFn: restoreDoc,
    ...options,
    onSuccess: (data, variables, context) => {
      listInvalidQueries?.forEach((queryKey) => {
        void queryClient.invalidateQueries({
          queryKey: [queryKey],
        });
      });
      if (options?.onSuccess) {
        void options.onSuccess(data, variables, context);
      }
    },
    onError: (error, variables, context) => {
      if (options?.onError) {
        void options.onError(error, variables, context);
      }
    },
  });
};
