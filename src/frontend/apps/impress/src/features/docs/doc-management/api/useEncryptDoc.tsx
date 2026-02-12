import {
  UseMutationOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { Doc } from '@/docs/doc-management/types';

interface EncryptDocProps {
  docId: string;
  content: Doc['content'];
  encryptedSymmetricKeyPerUser: Record<string, string>;
}

export const encryptDoc = async ({
  docId,
  ...params
}: EncryptDocProps): Promise<void> => {
  const response = await fetchAPI(`documents/${docId}/encrypt`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...params,
    }),
  });

  if (!response.ok) {
    throw new APIError(
      'Failed to encrypt the doc',
      await errorCauses(response),
    );
  }
};

type UseEncryptDocOptions = UseMutationOptions<void, APIError, EncryptDocProps>;

export const useEncryptDoc = ({
  listInvalidQueries,
  options,
}: {
  listInvalidQueries?: string[];
  options?: UseEncryptDocOptions;
}) => {
  const queryClient = useQueryClient();

  return useMutation<void, APIError, EncryptDocProps>({
    mutationFn: encryptDoc,
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
