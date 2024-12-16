import {
  UseMutationOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';
import {
  Access,
  KEY_DOC,
  KEY_LIST_DOC,
  Role,
} from '@/features/docs/doc-management';
import { useBroadcastStore } from '@/stores';

import { KEY_LIST_DOC_ACCESSES } from './useDocAccesses';

interface UpdateDocAccessProps {
  docId: string;
  accessId: string;
  role: Role;
}

export const updateDocAccess = async ({
  docId,
  accessId,
  role,
}: UpdateDocAccessProps): Promise<Access> => {
  const response = await fetchAPI(`documents/${docId}/accesses/${accessId}/`, {
    method: 'PATCH',
    body: JSON.stringify({
      role,
    }),
  });

  if (!response.ok) {
    throw new APIError('Failed to update role', await errorCauses(response));
  }

  return response.json() as Promise<Access>;
};

type UseUpdateDocAccess = Partial<Access>;

type UseUpdateDocAccessOptions = UseMutationOptions<
  Access,
  APIError,
  UseUpdateDocAccess
>;

export const useUpdateDocAccess = (options?: UseUpdateDocAccessOptions) => {
  const queryClient = useQueryClient();
  const { broadcast } = useBroadcastStore();

  return useMutation<Access, APIError, UpdateDocAccessProps>({
    mutationFn: updateDocAccess,
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
