import { UseQueryOptions, useQuery } from '@tanstack/react-query';

import {
  APIError,
  APIList,
  errorCauses,
  fetchAPI,
  useAPIInfiniteQuery,
} from '@/api';
import { Access } from '@/docs/doc-management';

export type DocAccessesParams = {
  docId: string;
  ordering?: string;
};

export type DocAccessesAPIParams = DocAccessesParams & {
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
export function useDocAccessesInfinite(params: DocAccessesParams) {
  return useAPIInfiniteQuery(KEY_LIST_DOC_ACCESSES, getDocAccesses, params);
}
