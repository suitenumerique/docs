import { UseQueryOptions, useQuery } from '@tanstack/react-query';

import {
  APIError,
  APIList,
  InfiniteQueryConfig,
  errorCauses,
  fetchAPI,
  useAPIInfiniteQuery,
} from '@/api';
import { Doc, DocsResponse } from '@/docs/doc-management';

export type DocsTrashbinParams = {
  page: number;
};

export type DocsTrashbinResponse = APIList<Doc>;
export const getDocsTrashbin = async (
  params: DocsTrashbinParams,
): Promise<DocsTrashbinResponse> => {
  const response = await fetchAPI(`documents/trashbin/?page=${params.page}`);

  if (!response.ok) {
    throw new APIError('Failed to get the docs', await errorCauses(response));
  }

  return response.json() as Promise<DocsTrashbinResponse>;
};

export const KEY_LIST_DOC_TRASHBIN = 'docs_trashbin';

type UseDocsTrashbinOptions = UseQueryOptions<
  DocsResponse,
  APIError,
  DocsResponse
>;
type UseInfiniteDocsTrashbinOptions = InfiniteQueryConfig<DocsTrashbinResponse>;

export function useDocsTrashbin(
  params: DocsTrashbinParams,
  queryConfig?: UseDocsTrashbinOptions,
) {
  return useQuery<DocsTrashbinResponse, APIError, DocsTrashbinResponse>({
    queryKey: [KEY_LIST_DOC_TRASHBIN, params],
    queryFn: () => getDocsTrashbin(params),
    ...queryConfig,
  });
}

export const useInfiniteDocsTrashbin = (
  params: DocsTrashbinParams,
  queryConfig?: UseInfiniteDocsTrashbinOptions,
) => {
  return useAPIInfiniteQuery(
    KEY_LIST_DOC_TRASHBIN,
    getDocsTrashbin,
    params,
    queryConfig,
  );
};
