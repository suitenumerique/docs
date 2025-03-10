import { useMutation, useQueryClient } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { Doc, Role } from '@/docs/doc-management';
import { Invitation, OptionType } from '@/docs/doc-share/types';
import { User } from '@/features/auth';

import { KEY_LIST_DOC_INVITATIONS } from './useDocInvitations';

interface CreateDocInvitationParams {
  email: User['email'];
  role: Role;
  docId: Doc['id'];
}

export const createDocInvitation = async ({
  email,
  role,
  docId,
}: CreateDocInvitationParams): Promise<Invitation> => {
  const response = await fetchAPI(`documents/${docId}/invitations/`, {
    method: 'POST',
    body: JSON.stringify({
      email,
      role,
    }),
  });

  if (!response.ok) {
    throw new APIError(
      `Failed to create the invitation for ${email}`,
      await errorCauses(response, {
        value: email,
        type: OptionType.INVITATION,
      }),
    );
  }

  return response.json() as Promise<Invitation>;
};

export function useCreateDocInvitation() {
  const queryClient = useQueryClient();
  return useMutation<Invitation, APIError, CreateDocInvitationParams>({
    mutationFn: createDocInvitation,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [KEY_LIST_DOC_INVITATIONS],
      });
    },
  });
}
