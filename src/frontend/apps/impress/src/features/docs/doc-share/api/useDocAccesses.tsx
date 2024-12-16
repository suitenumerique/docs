import {
  DefinedInitialDataInfiniteOptions,
  InfiniteData,
  QueryKey,
  UseQueryOptions,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';

import { APIError, APIList, errorCauses, fetchAPI } from '@/api';
import { Access } from '@/features/docs/doc-management';

export type DocAccessesParam = {
  docId: string;
  ordering?: string;
};

export type DocAccessesAPIParams = DocAccessesParam & {
  page: number;
};

type AccessesResponse = APIList<Access>;

export const getDocAccesses = async ({
  page,
  docId,
  ordering,
}: DocAccessesAPIParams): Promise<AccessesResponse> => {
  let url = `documents/${docId}/accesses/?page=${page}`;

  if (ordering) {
    url += '&ordering=' + ordering;
  }

  const response = await fetchAPI(url);

  if (!response.ok) {
    throw new APIError(
      'Failed to get the doc accesses',
      await errorCauses(response),
    );
  }

  return response.json() as Promise<AccessesResponse>;
};

export const KEY_LIST_DOC_ACCESSES = 'docs-accesses';

export function useDocAccesses(
  params: DocAccessesAPIParams,
  queryConfig?: UseQueryOptions<AccessesResponse, APIError, AccessesResponse>,
) {
  return useQuery<AccessesResponse, APIError, AccessesResponse>({
    queryKey: [KEY_LIST_DOC_ACCESSES, params],
    queryFn: () => getDocAccesses(params),
    ...queryConfig,
  });
}

/**
 * @param param Used for infinite scroll pagination
 * @param queryConfig
 * @returns
 */
export function useDocAccessesInfinite(
  param: DocAccessesParam,
  queryConfig?: DefinedInitialDataInfiniteOptions<
    AccessesResponse,
    APIError,
    InfiniteData<AccessesResponse>,
    QueryKey,
    number
  >,
) {
  return useInfiniteQuery<
    AccessesResponse,
    APIError,
    InfiniteData<AccessesResponse>,
    QueryKey,
    number
  >({
    initialPageParam: 1,
    queryKey: [KEY_LIST_DOC_ACCESSES, param],
    queryFn: ({ pageParam }) =>
      getDocAccesses({
        ...param,
        page: pageParam,
      }),
    getNextPageParam(lastPage, allPages) {
      return lastPage.next ? allPages.length + 1 : undefined;
    },
    ...queryConfig,
  });
}
