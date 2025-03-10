import { useMutation, useQueryClient } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';
import {
  Access,
  Doc,
  KEY_DOC,
  KEY_LIST_DOC,
  Role,
} from '@/docs/doc-management';
import { KEY_LIST_DOC_ACCESSES } from '@/docs/doc-share';
import { User } from '@/features/auth';
import { useBroadcastStore } from '@/stores';

import { OptionType } from '../types';

import { KEY_LIST_USER } from './useUsers';

interface CreateDocAccessParams {
  role: Role;
  docId: Doc['id'];
  memberId: User['id'];
}

export const createDocAccess = async ({
  memberId,
  role,
  docId,
}: CreateDocAccessParams): Promise<Access> => {
  const response = await fetchAPI(`documents/${docId}/accesses/`, {
    method: 'POST',
    body: JSON.stringify({
      user_id: memberId,
      role,
    }),
  });

  if (!response.ok) {
    throw new APIError(
      `Failed to add the member in the doc.`,
      await errorCauses(response, {
        type: OptionType.NEW_MEMBER,
      }),
    );
  }

  return response.json() as Promise<Access>;
};

export function useCreateDocAccess() {
  const queryClient = useQueryClient();
  const { broadcast } = useBroadcastStore();

  return useMutation<Access, APIError, CreateDocAccessParams>({
    mutationFn: createDocAccess,
    onSuccess: (_data, variable) => {
      void queryClient.resetQueries({
        queryKey: [KEY_LIST_DOC],
      });
      void queryClient.resetQueries({
        queryKey: [KEY_LIST_USER],
      });
      void queryClient.resetQueries({
        queryKey: [KEY_LIST_DOC_ACCESSES],
      });

      // Broadcast to every user connected to the document
      broadcast(`${KEY_DOC}-${variable.docId}`);
    },
  });
}
