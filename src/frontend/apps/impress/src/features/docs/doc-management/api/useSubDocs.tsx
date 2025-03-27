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

export type SubDocsParams = {
  page: number;
  ordering?: DocsOrdering;
  is_creator_me?: boolean;
  title?: string;
  is_favorite?: boolean;
  parent_id: string;
};

export type DocsResponse = APIList<Doc>;
export const getSubDocs = async (
  params: SubDocsParams,
): Promise<DocsResponse> => {
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
  searchParams.set('parent_id', params.parent_id);

  const response: Response = await fetchAPI(
    `documents/${params.parent_id}/descendants/?${searchParams.toString()}`,
  );

  if (!response.ok) {
    throw new APIError(
      'Failed to get the sub docs',
      await errorCauses(response),
    );
  }

  return response.json() as Promise<DocsResponse>;
};

export const KEY_LIST_SUB_DOC = 'sub-docs';

export function useSubDocs(
  params: SubDocsParams,
  queryConfig?: UseQueryOptions<DocsResponse, APIError, DocsResponse>,
) {
  return useQuery<DocsResponse, APIError, DocsResponse>({
    queryKey: [KEY_LIST_SUB_DOC, params],
    queryFn: () => getSubDocs(params),
    ...queryConfig,
  });
}

export const useInfiniteSubDocs = (
  params: SubDocsParams,
  queryConfig?: InfiniteQueryConfig<DocsResponse>,
) => {
  return useAPIInfiniteQuery(KEY_LIST_SUB_DOC, getSubDocs, params, queryConfig);
};
