import {
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/cunningham-react';
import {
  UseMutationOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import * as Y from 'yjs';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { toBase64 } from '@/docs/doc-editor';
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

export function useDuplicateDoc(options?: DuplicateDocOptions) {
  const queryClient = useQueryClient();
  const { toast } = useToastProvider();
  const { t } = useTranslation();
  const { provider } = useProviderStore();

  const { mutateAsync: updateDoc } = useUpdateDoc({
    listInvalidQueries: [KEY_LIST_DOC_VERSIONS],
  });

  return useMutation<DuplicateDocResponse, APIError, DuplicateDocParams>({
    mutationFn: async (variables) => {
      // Save the document if we can first, to ensure the latest state is duplicated
      const canSave =
        variables.canSave &&
        provider &&
        provider.document.guid === variables.docId;

      if (canSave) {
        const state = Y.encodeStateAsUpdate(provider.document);

        if (state) {
          await updateDoc({
            id: variables.docId,
            content: toBase64(state),
            contentEncrypted: false, // TODO: duplication should not be possible when encrypted?
          });
        }
      }

      return await duplicateDoc(variables);
    },
    onSuccess: (data, variables, onMutateResult, context) => {
      void queryClient.resetQueries({
        queryKey: [KEY_LIST_DOC],
      });

      toast(t('Document duplicated successfully!'), VariantType.SUCCESS, {
        duration: 3000,
      });

      void options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      toast(t('Failed to duplicate the document...'), VariantType.ERROR, {
        duration: 3000,
      });

      void options?.onError?.(error, variables, onMutateResult, context);
    },
  });
}
