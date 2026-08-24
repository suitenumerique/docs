import {
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/cunningham-react';
import {
  type InfiniteData,
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import * as Y from 'yjs';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { KEY_LIST_DOC_VERSIONS } from '@/docs/doc-versioning/api/useDocVersions';
import { toBase64 } from '@/utils/string';

import { useProviderStore } from '../stores';
import { Doc } from '../types';

import { useDocContentUpdate } from './useDocContentUpdate';
import { DocsParams, DocsResponse, KEY_LIST_DOC } from './useDocs';

interface DuplicateDocPayload {
  docId: string;
  with_accesses?: boolean;
  with_descendants?: boolean;
}

type DuplicateDocResponse = Doc;

export const duplicateDoc = async ({
  docId,
  with_accesses = false,
  with_descendants = true,
}: DuplicateDocPayload): Promise<DuplicateDocResponse> => {
  const response = await fetchAPI(`documents/${docId}/duplicate/`, {
    method: 'POST',
    body: JSON.stringify({ with_accesses, with_descendants }),
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

  const { mutateAsync: updateDocContent } = useDocContentUpdate({
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
        await updateDocContent({
          id: variables.docId,
          content: toBase64(Y.encodeStateAsUpdate(provider.document)),
        });
      }

      return await duplicateDoc(variables);
    },
    onSuccess: (data, variables, onMutateResult, context) => {
      // Add the duplicated document to the list of documents in the cache
      // It avoids the need to refetch the list of documents after duplicating a document
      queryClient.setQueriesData<InfiniteData<DocsResponse>>(
        {
          queryKey: [KEY_LIST_DOC],
          predicate: (query) => {
            const params = query.queryKey[1] as DocsParams | undefined;
            return params?.is_creator_me !== false;
          },
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          const [firstPage, ...restPages] = oldData.pages;

          return {
            ...oldData,
            pages: [
              {
                ...firstPage,
                count: firstPage.count + 1,
                results: [data, ...firstPage.results],
              },
              ...restPages,
            ],
          };
        },
      );

      void options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      const message = t('Failed to duplicate the document...');
      toast(message, VariantType.ERROR, {
        duration: 3000,
      });

      void options?.onError?.(error, variables, onMutateResult, context);
    },
  });
}
