import {
  UseQueryOptions,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect } from 'react';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { Doc } from '@/docs/doc-management';

import { reloadTree, useTreeContextOrNull } from '../utils';

export type DocsTreeParams = {
  docId: string;
};

export const getDocTree = async ({ docId }: DocsTreeParams): Promise<Doc> => {
  const response = await fetchAPI(`documents/${docId}/tree/`);

  if (!response.ok) {
    throw new APIError(
      'Failed to get the doc tree',
      await errorCauses(response),
    );
  }

  return response.json() as Promise<Doc>;
};

export const KEY_DOC_TREE = 'doc-tree';

export function useDocTree(
  params: DocsTreeParams,
  queryConfig?: UseQueryOptions<Doc, APIError, Doc>,
) {
  const queryClient = useQueryClient();
  const treeContext = useTreeContextOrNull<Doc | null>();

  /**
   * Bind the reloadTree function to the query cache subscription,
   * so that when the doc tree query is invalidated, the tree is reloaded.
   */
  useEffect(() => {
    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'invalidate') {
        return;
      }
      const queryKey = event.query.queryKey as readonly unknown[];
      if (queryKey[0] === KEY_DOC_TREE) {
        reloadTree(treeContext);
      }
    });
  }, [queryClient, treeContext]);

  return useQuery<Doc, APIError, Doc>({
    queryKey: [KEY_DOC_TREE, params],
    queryFn: () => getDocTree(params),
    staleTime: 0,
    refetchOnWindowFocus: false,
    ...queryConfig,
  });
}
