import {
  UseMutationOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

import { KEY_LIST_DOC_INVITATIONS } from './useDocInvitations';

interface DeleteDocInvitationProps {
  docId: string;
  invitationId: string;
}

type RemoveDocInvitationError = {
  role?: string[];
};

export const deleteDocInvitation = async ({
  docId,
  invitationId,
}: DeleteDocInvitationProps): Promise<void> => {
  const response = await fetchAPI(
    `documents/${docId}/invitations/${invitationId}/`,
    {
      method: 'DELETE',
    },
  );

  if (!response.ok) {
    throw new APIError(
      'Failed to delete the invitation',
      await errorCauses(response),
    );
  }
};

type UseDeleteDocInvitationOptions = UseMutationOptions<
  void,
  APIError<RemoveDocInvitationError>,
  DeleteDocInvitationProps
>;

export const useDeleteDocInvitation = (
  options?: UseDeleteDocInvitationOptions,
) => {
  const queryClient = useQueryClient();
  return useMutation<
    void,
    APIError<RemoveDocInvitationError>,
    DeleteDocInvitationProps
  >({
    mutationFn: deleteDocInvitation,
    ...options,
    onSuccess: (data, variables, context) => {
      void queryClient.invalidateQueries({
        queryKey: [KEY_LIST_DOC_INVITATIONS],
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
