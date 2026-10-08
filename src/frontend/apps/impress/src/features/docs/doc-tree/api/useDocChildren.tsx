import { UseQueryOptions, useQuery } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI, useAPIInfiniteQuery } from '@/api';

import { Doc, DocsResponse } from '../../doc-management';

export type DocsChildrenParams = {
  docId: string;
  page?: number;
  page_size?: number;
};

export const getDocChildren = async (
  params: DocsChildrenParams,
): Promise<DocsResponse> => {
  const { docId, page, page_size } = params;
  const searchParams = new URLSearchParams();

  if (page) {
    searchParams.set('page', page.toString());
  }
  if (page_size) {
    searchParams.set('page_size', page_size.toString());
  }

  const response = await fetchAPI(
    `documents/${docId}/children/?${searchParams.toString()}`,
  );

  if (!response.ok) {
    throw new APIError(
      'Failed to get the doc children',
      await errorCauses(response),
    );
  }

  return response.json() as Promise<DocsResponse>;
};

/**
 * Fetches every direct child of a doc, following the pagination.
 */
export const getAllDocChildren = async (docId: string): Promise<Doc[]> => {
  const children: Doc[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await getDocChildren({ docId, page, page_size: 200 });
    children.push(...response.results);
    hasMore = !!response.next;
    page++;
  }

  return children;
};

export const KEY_LIST_DOC_CHILDREN = 'doc-children';

export function useDocChildren(
  params: DocsChildrenParams,
  queryConfig?: Omit<
    UseQueryOptions<DocsResponse, APIError, DocsResponse>,
    'queryKey' | 'queryFn'
  >,
) {
  return useQuery<DocsResponse, APIError, DocsResponse>({
    queryKey: [KEY_LIST_DOC_CHILDREN, params],
    queryFn: () => getDocChildren(params),
    ...queryConfig,
  });
}

export const useInfiniteDocChildren = (params: DocsChildrenParams) => {
  return useAPIInfiniteQuery(KEY_LIST_DOC_CHILDREN, getDocChildren, params);
};
