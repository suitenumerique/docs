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
  /**
   * Hand the request over to the browser process so it survives the page
   * being torn down. Needed when saving from "beforeunload": a regular fetch
   * is aborted with the document, and the server never sees the request.
   */
  keepalive?: boolean;
}

/**
 * The fetch spec caps the body of a keepalive request. Over that limit the
 * browser rejects the request outright, so we fall back to a regular fetch.
 */
const KEEPALIVE_MAX_BODY_SIZE = 64 * 1024;

const buildContentBody = ({
  content,
  websocket,
}: Pick<UpdateDocContentParams, 'content' | 'websocket'>) =>
  JSON.stringify({
    content,
    websocket,
  });

/** Whether the doc is small enough to be saved with a keepalive request. */
export const canKeepaliveContent = (
  params: Pick<UpdateDocContentParams, 'content' | 'websocket'>,
) => buildContentBody(params).length <= KEEPALIVE_MAX_BODY_SIZE;

export const updateDocContent = async ({
  id,
  content,
  websocket,
  keepalive,
}: UpdateDocContentParams): Promise<void> => {
  if (!uuidValidate(id)) {
    throw new Error(`Invalid doc id in updateDocContent: ${id}`);
  }

  const body = buildContentBody({ content, websocket });

  const response = await fetchAPI(`documents/${id}/content/`, {
    method: 'PATCH',
    body,
    keepalive: keepalive && body.length <= KEEPALIVE_MAX_BODY_SIZE,
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
