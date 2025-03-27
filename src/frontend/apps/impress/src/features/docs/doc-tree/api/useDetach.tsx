import { useMutation, useQueryClient } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

import { KEY_DOC, KEY_LIST_DOC } from '../../doc-management';

export type DetachDocParam = {
  documentId: string;
  rootId: string;
};

export const detachDoc = async ({
  documentId,
  rootId,
}: DetachDocParam): Promise<void> => {
  const response = await fetchAPI(`documents/${documentId}/move/`, {
    method: 'POST',
    body: JSON.stringify({
      target_document_id: rootId,
      position: 'last-sibling',
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
