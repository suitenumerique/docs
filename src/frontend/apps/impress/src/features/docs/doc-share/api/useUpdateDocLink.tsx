import {
  UseMutationOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { Doc, LinkReach, LinkRole } from '@/docs/doc-management';
import { syncDocInTree, useTreeContextOrNull } from '@/docs/doc-tree/utils';

export type UpdateDocLinkParams = Pick<Doc, 'id' | 'link_reach'> &
  Partial<Pick<Doc, 'link_role'>>;

type UpdateDocLinkResponse = { link_role: LinkRole; link_reach: LinkReach };

export const updateDocLink = async ({
  id,
  ...params
}: UpdateDocLinkParams): Promise<UpdateDocLinkResponse> => {
  const response = await fetchAPI(`documents/${id}/link-configuration/`, {
    method: 'PUT',
    body: JSON.stringify({
      ...params,
    }),
  });

  if (!response.ok) {
    throw new APIError(
      'Failed to update the doc link',
      await errorCauses(response),
    );
  }

  return response.json() as Promise<UpdateDocLinkResponse>;
};

type UseUpdateDocLinkOptions = UseMutationOptions<
  UpdateDocLinkResponse,
  APIError,
  UpdateDocLinkParams
> & {
  listInvalidQueries?: string[];
};

export function useUpdateDocLink(options?: UseUpdateDocLinkOptions) {
  const queryClient = useQueryClient();
  const treeContext = useTreeContextOrNull();

  return useMutation<UpdateDocLinkResponse, APIError, UpdateDocLinkParams>({
    mutationFn: updateDocLink,
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      options?.listInvalidQueries?.forEach((queryKey) => {
        void queryClient.invalidateQueries({
          queryKey: [queryKey],
        });
      });

      /**
       * Can be loaded from the doc tree, we need to resync the doc tree
       * in order to reflect the changes in the tree view.
       */
      syncDocInTree(treeContext, variables.id, {
        link_reach: data.link_reach,
        link_role: data.link_role,
        computed_link_reach: data.link_reach,
        computed_link_role: data.link_role,
      });

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
