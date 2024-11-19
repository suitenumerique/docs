import { UseQueryOptions, useQuery } from '@tanstack/react-query';

import {
  APIError,
  APIList,
  errorCauses,
  fetchAPI,
  useAPIInfiniteQuery,
} from '@/api';

import { Doc } from '../types';

export const isDocsOrdering = (data: string): data is DocsOrdering => {
  return !!docsOrdering.find((validKey) => validKey === data);
};

const docsOrdering = [
  'created_at',
  '-created_at',
  'updated_at',
  '-updated_at',
  'title',
  '-title',
] as const;

export type DocsOrdering = (typeof docsOrdering)[number];

export type DocsParams = {
  page: number;
  ordering?: DocsOrdering;
};

export type DocsResponse = APIList<Doc>;

export const getDocs = async ({
  ordering,
  page,
}: DocsParams): Promise<DocsResponse> => {
  const orderingQuery = ordering ? `&ordering=${ordering}` : '';
  const response = await fetchAPI(`documents/?page=${page}${orderingQuery}`);

  if (!response.ok) {
    throw new APIError('Failed to get the docs', await errorCauses(response));
  }

  return response.json() as Promise<DocsResponse>;
};

export const KEY_LIST_DOC = 'docs';

export function useDocs(
  params: DocsParams,
  queryConfig?: UseQueryOptions<DocsResponse, APIError, DocsResponse>,
) {
  return useQuery<DocsResponse, APIError, DocsResponse>({
    queryKey: [KEY_LIST_DOC, params],
    queryFn: () => getDocs(params),
    ...queryConfig,
  });
}

export const useInfiniteDocs = (params: DocsParams) => {
  return useAPIInfiniteQuery(KEY_LIST_DOC, getDocs, params);
};
