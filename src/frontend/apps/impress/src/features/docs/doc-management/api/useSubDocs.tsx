import { UseQueryOptions, useQuery } from '@tanstack/react-query';

import {
  APIError,
  InfiniteQueryConfig,
  errorCauses,
  fetchAPI,
  useAPIInfiniteQuery,
} from '@/api';

import { DocsOrdering } from '../types';

import { DocsResponse, constructParams } from './useDocs';

export type SubDocsParams = {
  page: number;
  ordering?: DocsOrdering;
  is_creator_me?: boolean;
  title?: string;
  is_favorite?: boolean;
  parent_id: string;
};

export const getSubDocs = async (
  params: SubDocsParams,
): Promise<DocsResponse> => {
  const searchParams = constructParams(params);
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
