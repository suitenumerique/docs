import {
  UseMutationOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { Role } from '@/features/docs/doc-management';
import { Invitation } from '@/features/docs/doc-share/types';

import { KEY_LIST_DOC_INVITATIONS } from './useDocInvitations';

interface UpdateDocInvitationProps {
  docId: string;
  invitationId: string;
  role: Role;
}

type UpdateDocInvitationError = {
  role?: string[];
};

export const updateDocInvitation = async ({
  docId,
  invitationId,
  role,
}: UpdateDocInvitationProps): Promise<Invitation> => {
  const response = await fetchAPI(
    `documents/${docId}/invitations/${invitationId}/`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        role,
      }),
    },
  );

  if (!response.ok) {
    throw new APIError('Failed to update role', await errorCauses(response));
  }

  return response.json() as Promise<Invitation>;
};

type UseUpdateDocInvitation = Partial<Invitation>;

type UseUpdateDocInvitationOptions = UseMutationOptions<
  Invitation,
  APIError<UpdateDocInvitationError>,
  UseUpdateDocInvitation
>;

export const useUpdateDocInvitation = (
  options?: UseUpdateDocInvitationOptions,
) => {
  const queryClient = useQueryClient();
  return useMutation<
    Invitation,
    APIError<UpdateDocInvitationError>,
    UpdateDocInvitationProps
  >({
    mutationFn: updateDocInvitation,
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
