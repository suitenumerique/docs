import {
  InfiniteData,
  QueryKey,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';

import {
  APIError,
  DefinedInitialDataInfiniteOptionsAPI,
  UseQueryOptionsAPI,
  errorCauses,
  fetchAPI,
} from '@/api';

import { APIListVersions } from '../types';

export type DocVersionsParam = {
  docId: string;
};

export type DocVersionsAPIParams = DocVersionsParam & {
  versionId: string;
};

type VersionsResponse = APIListVersions;

const getDocVersions = async ({
  versionId,
  docId,
}: DocVersionsAPIParams): Promise<VersionsResponse> => {
  const url = `documents/${docId}/versions/?version_id=${versionId}`;

  const response = await fetchAPI(url);

  if (!response.ok) {
    throw new APIError(
      'Failed to get the doc versions',
      await errorCauses(response),
    );
  }

  return response.json() as Promise<VersionsResponse>;
};

export const KEY_LIST_DOC_VERSIONS = 'doc-versions';

export function useDocVersions(
  params: DocVersionsAPIParams,
  queryConfig?: UseQueryOptionsAPI<VersionsResponse>,
) {
  return useQuery<VersionsResponse, APIError, VersionsResponse>({
    queryKey: [KEY_LIST_DOC_VERSIONS, params],
    queryFn: () => getDocVersions(params),
    ...queryConfig,
  });
}

export function useDocVersionsInfiniteQuery(
  param: DocVersionsParam,
  queryConfig?: DefinedInitialDataInfiniteOptionsAPI<VersionsResponse, string>,
) {
  return useInfiniteQuery<
    VersionsResponse,
    APIError,
    InfiniteData<VersionsResponse>,
    QueryKey,
    string
  >({
    initialPageParam: '',
    queryKey: [KEY_LIST_DOC_VERSIONS, param],
    queryFn: ({ pageParam }) =>
      getDocVersions({
        ...param,
        versionId: pageParam,
      }),
    getNextPageParam(lastPage) {
      return lastPage.next_version_id_marker || undefined;
    },

    ...queryConfig,
  });
}
