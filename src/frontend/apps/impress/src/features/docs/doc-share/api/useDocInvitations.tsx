import {
  DefinedInitialDataInfiniteOptions,
  InfiniteData,
  QueryKey,
  UseQueryOptions,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';

import { APIError, APIList, errorCauses, fetchAPI } from '@/api';
import { Invitation } from '@/features/docs/doc-share/types';

export type DocInvitationsParams = {
  docId: string;
  ordering?: string;
};

export type DocInvitationsAPIParams = DocInvitationsParams & {
  page: number;
};

type DocInvitationsResponse = APIList<Invitation>;

export const getDocInvitations = async ({
  page,
  docId,
  ordering,
}: DocInvitationsAPIParams): Promise<DocInvitationsResponse> => {
  let url = `documents/${docId}/invitations/?page=${page}`;

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

  return response.json() as Promise<DocInvitationsResponse>;
};

export const KEY_LIST_DOC_INVITATIONS = 'docs-invitations';

export function useDocInvitations(
  params: DocInvitationsAPIParams,
  queryConfig?: UseQueryOptions<
    DocInvitationsResponse,
    APIError,
    DocInvitationsResponse
  >,
) {
  return useQuery<DocInvitationsResponse, APIError, DocInvitationsResponse>({
    queryKey: [KEY_LIST_DOC_INVITATIONS, params],
    queryFn: () => getDocInvitations(params),
    ...queryConfig,
  });
}

/**
 * @param param Used for infinite scroll pagination
 * @param queryConfig
 * @returns
 */
export function useDocInvitationsInfinite(
  param: DocInvitationsParams,
  queryConfig?: DefinedInitialDataInfiniteOptions<
    DocInvitationsResponse,
    APIError,
    InfiniteData<DocInvitationsResponse>,
    QueryKey,
    number
  >,
) {
  return useInfiniteQuery<
    DocInvitationsResponse,
    APIError,
    InfiniteData<DocInvitationsResponse>,
    QueryKey,
    number
  >({
    initialPageParam: 1,
    queryKey: [KEY_LIST_DOC_INVITATIONS, param],
    queryFn: ({ pageParam }) =>
      getDocInvitations({
        ...param,
        page: pageParam,
      }),
    getNextPageParam(lastPage, allPages) {
      return lastPage.next ? allPages.length + 1 : undefined;
    },
    ...queryConfig,
  });
}
