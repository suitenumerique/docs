import { useMutation, useQueryClient } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

import { KEY_DOC, KEY_LIST_DOC } from '../../doc-management';

export type DetachDocParam = {
  documentId: string;
  rootId: string;
};

enum POSITION_MOVE {
  FIRST_CHILD = 'first-child',
  LAST_CHILD = 'last-child',
  FIRST_SIBLING = 'first-sibling',
  LAST_SIBLING = 'last-sibling',
  LEFT = 'left',
  RIGHT = 'right',
}

export const detachDoc = async ({
  documentId,
  rootId,
}: DetachDocParam): Promise<void> => {
  const response = await fetchAPI(`documents/${documentId}/move/`, {
    method: 'POST',
    body: JSON.stringify({
      target_document_id: rootId,
      position: POSITION_MOVE.LAST_SIBLING,
    }),
  });

  if (!response.ok) {
    throw new APIError('Failed to move the doc', await errorCauses(response));
  }

  return response.json() as Promise<void>;
};

export function useDetachDoc() {
  const queryClient = useQueryClient();
  return useMutation<void, APIError, DetachDocParam>({
    mutationFn: detachDoc,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: [KEY_LIST_DOC] });
      void queryClient.invalidateQueries({
        queryKey: [KEY_DOC, { id: variables.documentId }],
      });
    },
  });
}
