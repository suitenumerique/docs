import {
  UseMutationOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { toBase64 } from '@/features/docs/doc-editor';

interface RemoveDocEncryptionProps {
  docId: string;
  content: Uint8Array<ArrayBufferLike>;
}

export const removeDocEncryption = async ({
  docId,
  ...params
}: RemoveDocEncryptionProps): Promise<void> => {
  const response = await fetchAPI(`documents/${docId}/remove-encryption`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...params,
      content: toBase64(params.content),
    }),
  });

  if (!response.ok) {
    throw new APIError(
      'Failed to remove encryption from the doc',
      await errorCauses(response),
    );
  }
};

type UseRemoveDocEncryptionOptions = UseMutationOptions<
  void,
  APIError,
  RemoveDocEncryptionProps
>;

export const useRemoveDocEncryption = ({
  listInvalidQueries,
  options,
}: {
  listInvalidQueries?: string[];
  options?: UseRemoveDocEncryptionOptions;
}) => {
  const queryClient = useQueryClient();

  return useMutation<void, APIError, RemoveDocEncryptionProps>({
    mutationFn: removeDocEncryption,
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
