import { TreeViewMoveModeEnum } from '@gouvfr-lasuite/ui-components';
import {
  UseMutationOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { KEY_DOC_TREE } from '@/docs/doc-tree/api/useDocTree';

import { KEY_DOC } from './useDoc';
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

type UseMoveDocOptions = UseMutationOptions<void, APIError, MoveDocParam>;

export function useMoveDoc(options?: UseMoveDocOptions) {
  const queryClient = useQueryClient();

  return useMutation<void, APIError, MoveDocParam>({
    mutationFn: moveDoc,
    ...options,
    onSuccess(data, variables, onMutateResult, context) {
      void queryClient.invalidateQueries({ queryKey: [KEY_LIST_DOC] });
      void queryClient.invalidateQueries({ queryKey: [KEY_DOC] });
      void queryClient.invalidateQueries({ queryKey: [KEY_DOC_TREE] });

      if (options?.onSuccess) {
        void options.onSuccess(data, variables, onMutateResult, context);
      }
    },
  });
}
