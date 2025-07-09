import { UseQueryOptions, useQuery } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

import { Doc } from '../../doc-management';

export type DocsTreeParams = {
  docId: string;
};

export const getDocTree = async ({ docId }: DocsTreeParams): Promise<Doc> => {
  const searchParams = new URLSearchParams();

  const response = await fetchAPI(
    `documents/${docId}/tree/?${searchParams.toString()}`,
  );

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
  queryConfig?: Omit<
    UseQueryOptions<Doc, APIError, Doc>,
    'queryKey' | 'queryFn'
  >,
) {
  return useQuery<Doc, APIError, Doc>({
    queryKey: [KEY_DOC_TREE, params],
    queryFn: () => getDocTree(params),
    staleTime: 0,
    refetchOnWindowFocus: false,
    ...queryConfig,
  });
}
