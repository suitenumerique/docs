import {
  UseMutationOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { validate as uuidValidate } from 'uuid';

import { APIError, errorCauses, fetchAPI } from '@/api';

import { Doc } from '../types';

import { KEY_DOC_CONTENT } from './useDocContent';

export interface UpdateDocContentParams {
  id: Doc['id'];
  content: string; // Base64 encoded content
  websocket?: boolean;
}

export const updateDocContent = async ({
  id,
  content,
  websocket,
}: UpdateDocContentParams): Promise<void> => {
  if (!uuidValidate(id)) {
    throw new Error(`Invalid doc id in updateDocContent: ${id}`);
  }

  const response = await fetchAPI(`documents/${id}/content/`, {
    method: 'PATCH',
    body: JSON.stringify({
      content,
      websocket,
    }),
  });

  if (!response.ok) {
    throw new APIError(
      'Failed to update the doc content',
      await errorCauses(response),
    );
  }
};

type UseDocContentUpdate = UseMutationOptions<
  void,
  APIError,
  UpdateDocContentParams
> & {
  isOptimistic?: boolean;
  listInvalidQueries?: string[];
};

export function useDocContentUpdate(queryConfig?: UseDocContentUpdate) {
  const queryClient = useQueryClient();
  return useMutation<void, APIError, UpdateDocContentParams>({
    mutationFn: updateDocContent,
    ...queryConfig,
    onMutate: (variables) => {
      /**
       * If optimistic, we update the content cache immediately with the new content
       * It is useful when we are in offline mode because the onSuccess is not always triggered.
       */
      if (queryConfig?.isOptimistic) {
        const previousContent = queryClient.getQueryData([
          KEY_DOC_CONTENT,
          { id: variables.id },
        ]);

        queryClient.setQueryData(
          [KEY_DOC_CONTENT, { id: variables.id }],
          variables.content,
        );

        return { previousContent };
      }
    },
    onSuccess: (data, variables, onMutateResult, context) => {
      if (!queryConfig?.isOptimistic) {
        /**
         * If not optimistic, we need to update the content cache with the new content returned
         * from the server
         */
        queryClient.setQueryData(
          [KEY_DOC_CONTENT, { id: variables.id }],
          variables.content,
        );
      }

      queryConfig?.listInvalidQueries?.forEach((queryKey) => {
        void queryClient.resetQueries({
          queryKey: [queryKey],
        });
      });

      if (queryConfig?.onSuccess) {
        void queryConfig.onSuccess(data, variables, onMutateResult, context);
      }
    },
    onError: (error, variables, onMutateResult, context) => {
      if (
        queryConfig?.isOptimistic &&
        (onMutateResult as { previousContent: unknown })?.previousContent
      ) {
        const previousContent = (onMutateResult as { previousContent: unknown })
          .previousContent;

        queryClient.setQueryData(
          [KEY_DOC_CONTENT, { id: variables.id }],
          previousContent,
        );
      }

      if (queryConfig?.onError) {
        queryConfig.onError(error, variables, onMutateResult, context);
      }
    },
  });
}
