import { UseQueryOptions, useQuery } from '@tanstack/react-query';

import {
  APIError,
  APIList,
  InfiniteQueryConfig,
  errorCauses,
  fetchAPI,
  useAPIInfiniteQuery,
} from '@/api';

import { Doc } from '../types';

export type DocsFavoriteParams = {
  page: number;
};

export type DocsFavoriteResponse = APIList<Doc>;
export const getDocsFavorite = async (
  params: DocsFavoriteParams,
): Promise<DocsFavoriteResponse> => {
  const searchParams = new URLSearchParams();

  if (params.page) {
    searchParams.set('page', params.page.toString());
  }

  const response = await fetchAPI(
    `documents/favorite_list/?${searchParams.toString()}`,
  );

  if (!response.ok) {
    throw new APIError(
      'Failed to get the favorite docs',
      await errorCauses(response),
    );
  }

  return response.json() as Promise<DocsFavoriteResponse>;
};

export const KEY_LIST_FAVORITE_DOC = 'docs_favorite_list';

type UseDocsOptions = UseQueryOptions<
  DocsFavoriteResponse,
  APIError,
  DocsFavoriteResponse
>;
type UseInfiniteDocsOptions = InfiniteQueryConfig<DocsFavoriteResponse>;

export function useDocsFavorite(
  params: DocsFavoriteParams,
  queryConfig?: UseDocsOptions,
) {
  return useQuery<DocsFavoriteResponse, APIError, DocsFavoriteResponse>({
    queryKey: [KEY_LIST_FAVORITE_DOC, params],
    queryFn: () => getDocsFavorite(params),
    ...queryConfig,
  });
}

export const useInfiniteDocsFavorite = (
  params: DocsFavoriteParams,
  queryConfig?: UseInfiniteDocsOptions,
) => {
  return useAPIInfiniteQuery(
    KEY_LIST_FAVORITE_DOC,
    getDocsFavorite,
    params,
    queryConfig,
  );
};
