import { UseQueryOptions, useQuery } from '@tanstack/react-query';

import {
  APIError,
  APIList,
  InfiniteQueryConfig,
  errorCauses,
  fetchAPI,
  useAPIInfiniteQuery,
} from '@/api';

import { Doc, DocsOrdering } from '../types';

export type DocsParams = {
  page: number;
  ordering?: DocsOrdering;
  is_creator_me?: boolean;
  is_favorite?: boolean;
};

export const constructParams = (params: DocsParams): URLSearchParams => {
  const searchParams = new URLSearchParams();

  if (params.page) {
    searchParams.set('page', params.page.toString());
  }
  if (params.ordering) {
    searchParams.set('ordering', params.ordering);
  }
  if (params.is_creator_me !== undefined) {
    searchParams.set('is_creator_me', params.is_creator_me.toString());
  }
  if (params.is_favorite !== undefined) {
    searchParams.set('is_favorite', params.is_favorite.toString());
  }

  return searchParams;
};

export type DocsResponse = APIList<Doc>;
export const getDocs = async (params: DocsParams): Promise<DocsResponse> => {
  const searchParams = constructParams(params);
  const response = await fetchAPI(`documents/?${searchParams.toString()}`);

  if (!response.ok) {
    throw new APIError('Failed to get the docs', await errorCauses(response));
  }

  return response.json() as Promise<DocsResponse>;
};

export const KEY_LIST_DOC = 'docs';

type UseDocsOptions = UseQueryOptions<DocsResponse, APIError, DocsResponse>;
type UseInfiniteDocsOptions = InfiniteQueryConfig<DocsResponse>;

export function useDocs(params: DocsParams, queryConfig?: UseDocsOptions) {
  return useQuery<DocsResponse, APIError, DocsResponse>({
    queryKey: [KEY_LIST_DOC, params],
    queryFn: () => getDocs(params),
    ...queryConfig,
  });
}

export const useInfiniteDocs = (
  params: DocsParams,
  queryConfig?: UseInfiniteDocsOptions,
) => {
  return useAPIInfiniteQuery(KEY_LIST_DOC, getDocs, params, queryConfig);
};
