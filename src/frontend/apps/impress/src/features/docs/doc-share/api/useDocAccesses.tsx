import {
  DefinedInitialDataInfiniteOptions,
  InfiniteData,
  QueryKey,
  UseQueryOptions,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';

import { APIError, APIList, errorCauses, fetchAPI } from '@/api';
import { Access } from '@/docs/doc-management';

export type DocAccessesParam = {
  docId: string;
  ordering?: string;
};

export type DocAccessesAPIParams = DocAccessesParam & {
  page?: number;
};

type AccessesResponse = APIList<Access>;

export const getDocAccesses = async ({
  page,
  docId,
  ordering,
}: DocAccessesAPIParams): Promise<Access[]> => {
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

  return (await response.json()) as Access[];
};

export const KEY_LIST_DOC_ACCESSES = 'docs-accesses';

export function useDocAccesses(
  params: DocAccessesAPIParams,
  queryConfig?: UseQueryOptions<Access[], APIError, Access[]>,
) {
  return useQuery<Access[], APIError, Access[]>({
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
