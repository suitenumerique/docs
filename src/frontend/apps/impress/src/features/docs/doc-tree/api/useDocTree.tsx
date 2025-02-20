import { UseQueryOptions, useQuery } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

import { Doc } from '../../doc-management';

export type DocsTreeParams = {
  docId: string;
  page: number;
  page_size?: number;
};

export const getDocTree = async (params: DocsTreeParams): Promise<Doc[]> => {
  const { docId, page, page_size } = params;
  const searchParams = new URLSearchParams();

  if (page) {
    searchParams.set('page', page.toString());
  }
  if (page_size) {
    searchParams.set('page_size', page_size.toString());
  }

  const response = await fetchAPI(
    `documents/${docId}/tree/?${searchParams.toString()}`,
  );

  if (!response.ok) {
    throw new APIError(
      'Failed to get the doc tree',
      await errorCauses(response),
    );
  }

  return response.json() as Promise<Doc[]>;
};

export const KEY_LIST_DOC_CHILDREN = 'doc-tree';

export function useDocTree(
  params: DocsTreeParams,
  queryConfig?: Omit<
    UseQueryOptions<Doc[], APIError, Doc[]>,
    'queryKey' | 'queryFn'
  >,
) {
  return useQuery<Doc[], APIError, Doc[]>({
    queryKey: [KEY_LIST_DOC_CHILDREN, params],
    queryFn: () => getDocTree(params),
    ...queryConfig,
  });
}
