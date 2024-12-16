import { useMutation, useQueryClient } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { User } from '@/core/auth';
import { Doc, Role } from '@/features/docs/doc-management';
import { Invitation, OptionType } from '@/features/docs/doc-share/types';
import { ContentLanguage } from '@/i18n/types';

import { KEY_LIST_DOC_INVITATIONS } from './useDocInvitations';

interface CreateDocInvitationParams {
  email: User['email'];
  role: Role;
  docId: Doc['id'];
  contentLanguage: ContentLanguage;
}

export const createDocInvitation = async ({
  email,
  role,
  docId,
  contentLanguage,
}: CreateDocInvitationParams): Promise<Invitation> => {
  const response = await fetchAPI(`documents/${docId}/invitations/`, {
    method: 'POST',
    headers: {
      'Content-Language': contentLanguage,
    },
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
