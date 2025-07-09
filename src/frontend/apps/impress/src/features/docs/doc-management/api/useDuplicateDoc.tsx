import {
  UseMutationOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import * as Y from 'yjs';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { toBase64 } from '@/docs/doc-editor';
import { KEY_DOC_TREE } from '@/docs/doc-tree';
import { KEY_LIST_DOC_VERSIONS } from '@/docs/doc-versioning';

import { useProviderStore } from '../stores';
import { Doc } from '../types';

import { KEY_LIST_DOC } from './useDocs';
import { useUpdateDoc } from './useUpdateDoc';

interface DuplicateDocPayload {
  docId: string;
  with_accesses?: boolean;
}

type DuplicateDocResponse = Pick<Doc, 'id'>;

export const duplicateDoc = async ({
  docId,
  with_accesses,
}: DuplicateDocPayload): Promise<DuplicateDocResponse> => {
  const response = await fetchAPI(`documents/${docId}/duplicate/`, {
    method: 'POST',
    body: JSON.stringify({ with_accesses }),
  });

  if (!response.ok) {
    throw new APIError(
      'Failed to duplicate the doc',
      await errorCauses(response),
    );
  }

  return response.json() as Promise<DuplicateDocResponse>;
};

type DuplicateDocParams = DuplicateDocPayload & {
  canSave: boolean;
};

type DuplicateDocOptions = UseMutationOptions<
  DuplicateDocResponse,
  APIError,
  DuplicateDocParams
>;

export function useDuplicateDoc(options: DuplicateDocOptions) {
  const queryClient = useQueryClient();

  const { provider } = useProviderStore();

  const { mutateAsync: updateDoc } = useUpdateDoc({
    listInvalideQueries: [KEY_LIST_DOC_VERSIONS],
  });

  return useMutation<DuplicateDocResponse, APIError, DuplicateDocParams>({
    mutationFn: async (variables) => {
      try {
        // Save the document if we can first, to ensure the latest state is duplicated
        if (
          variables.canSave &&
          provider &&
          provider.document.guid === variables.docId
        ) {
          await updateDoc({
            id: variables.docId,
            content: toBase64(Y.encodeStateAsUpdate(provider.document)),
          });
        }

        return await duplicateDoc(variables);
      } catch (error) {
        // If save fails, throw the error to prevent duplication
        throw error;
      }
    },
    onSuccess: (data, variables, context) => {
      void queryClient.resetQueries({
        queryKey: [KEY_LIST_DOC],
      });
      void queryClient.resetQueries({
        queryKey: [KEY_DOC_TREE],
      });
      void options.onSuccess?.(data, variables, context);
    },
  });
}
