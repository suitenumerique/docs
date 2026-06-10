import {
  UseMutationOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { KEY_LIST_DOC } from '@/docs/doc-management/api';

interface LeaveDocProps {
  docId: string;
}

export const leaveDoc = async ({ docId }: LeaveDocProps): Promise<void> => {
  const response = await fetchAPI(`documents/${docId}/leave/`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new APIError(
      'Failed to leave the document',
      await errorCauses(response),
    );
  }
};

type UseLeaveDocOptions = UseMutationOptions<void, APIError, LeaveDocProps>;

export const useLeaveDoc = (options?: UseLeaveDocOptions) => {
  const queryClient = useQueryClient();

  return useMutation<void, APIError, LeaveDocProps>({
    mutationFn: leaveDoc,
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      void queryClient.invalidateQueries({
        queryKey: [KEY_LIST_DOC],
      });

      if (options?.onSuccess) {
        void options.onSuccess(data, variables, onMutateResult, context);
      }
    },
  });
};
