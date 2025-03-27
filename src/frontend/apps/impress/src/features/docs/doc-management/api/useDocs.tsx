import { UseQueryOptions, useQuery } from '@tanstack/react-query';

import {
  APIError,
  APIList,
  errorCauses,
  fetchAPI,
  useAPIInfiniteQuery,
} from '@/api';

import { Doc, DocsOrdering } from '../types';

export type DocsParams = {
  page: number;
  ordering?: DocsOrdering;
  is_creator_me?: boolean;
  title?: string;
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
  if (params.title && params.title.length > 0) {
    searchParams.set('title', params.title);
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
