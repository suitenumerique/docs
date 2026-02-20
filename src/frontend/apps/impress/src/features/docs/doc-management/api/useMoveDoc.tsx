import { TreeViewMoveModeEnum } from '@gouvfr-lasuite/ui-kit';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';
import {
  getDocAccesses,
  getDocInvitations,
  useDeleteDocAccess,
  useDeleteDocInvitation,
} from '@/docs/doc-share';

import { KEY_LIST_DOC } from './useDocs';

export type MoveDocParam = {
  sourceDocumentId: string;
  targetDocumentId: string;
  position: TreeViewMoveModeEnum;
};

export const moveDoc = async ({
  sourceDocumentId,
  targetDocumentId,
  position,
}: MoveDocParam): Promise<void> => {
  const response = await fetchAPI(`documents/${sourceDocumentId}/move/`, {
    method: 'POST',
    body: JSON.stringify({
      target_document_id: targetDocumentId,
      position,
    }),
  });

  if (!response.ok) {
    throw new APIError('Failed to move the doc', await errorCauses(response));
  }

  return response.json() as Promise<void>;
};

export function useMoveDoc(deleteAccessOnMove = false) {
  const queryClient = useQueryClient();
  const { mutate: handleDeleteInvitation } = useDeleteDocInvitation();
  const { mutate: handleDeleteAccess } = useDeleteDocAccess();

  return useMutation<void, APIError, MoveDocParam>({
    mutationFn: moveDoc,
    async onSuccess(_data, variables, _onMutateResult, _context) {
      if (!deleteAccessOnMove) {
        return;
      }

      void queryClient.invalidateQueries({
        queryKey: [KEY_LIST_DOC],
      });
      const accesses = await getDocAccesses({
        docId: variables.sourceDocumentId,
      });

      const invitationsResponse = await getDocInvitations({
        docId: variables.sourceDocumentId,
        page: 1,
      });

      const invitations = invitationsResponse.results;

      await Promise.all([
        ...invitations.map((invitation) =>
          handleDeleteInvitation({
            docId: variables.sourceDocumentId,
            invitationId: invitation.id,
          }),
        ),
        ...accesses.map((access) =>
          handleDeleteAccess({
            docId: variables.sourceDocumentId,
            accessId: access.id,
          }),
        ),
      ]);
    },
  });
}
