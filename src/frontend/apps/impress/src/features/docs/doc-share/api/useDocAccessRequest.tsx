import {
  UseMutationOptions,
  UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  APIError,
  APIList,
  errorCauses,
  fetchAPI,
  useAPIInfiniteQuery,
} from '@/api';
import { AccessRequest, Doc, Role } from '@/docs/doc-management';

import { OptionType } from '../types';

import { KEY_LIST_DOC_ACCESSES } from './useDocAccesses';

interface CreateDocAccessRequestParams {
  docId: Doc['id'];
  role?: Role;
}

export const createDocAccessRequest = async ({
  docId,
  role,
}: CreateDocAccessRequestParams): Promise<void> => {
  const response = await fetchAPI(`documents/${docId}/ask-for-access/`, {
    method: 'POST',
    body: JSON.stringify({
      role,
    }),
  });

  if (!response.ok) {
    throw new APIError(
      `Failed to create a request to access to the doc.`,
      await errorCauses(response, {
        type: OptionType.NEW_MEMBER,
      }),
    );
  }
};

type UseCreateDocAccessRequestOptions = UseMutationOptions<
  void,
  APIError,
  CreateDocAccessRequestParams
>;

export function useCreateDocAccessRequest(
  options?: UseCreateDocAccessRequestOptions,
) {
  const queryClient = useQueryClient();

  return useMutation<void, APIError, CreateDocAccessRequestParams>({
    mutationFn: createDocAccessRequest,
    ...options,
    onSuccess: (data, variables, context) => {
      void queryClient.resetQueries({
        queryKey: [KEY_LIST_DOC_ACCESS_REQUESTS],
      });

      void options?.onSuccess?.(data, variables, context);
    },
  });
}

type AccessRequestResponse = APIList<AccessRequest>;

interface DocAccessRequestsParams {
  docId: Doc['id'];
}

export type DocAccessRequestsAPIParams = DocAccessRequestsParams & {
  page: number;
};

export const getDocAccessRequests = async ({
  docId,
  page,
}: DocAccessRequestsAPIParams): Promise<AccessRequestResponse> => {
  const response = await fetchAPI(
    `documents/${docId}/ask-for-access/?page=${page}`,
  );

  if (!response.ok) {
    throw new APIError(
      'Failed to get the doc access requests',
      await errorCauses(response),
    );
  }

  return response.json() as Promise<AccessRequestResponse>;
};

export const KEY_LIST_DOC_ACCESS_REQUESTS = 'docs-access-requests';

export function useDocAccessRequests(
  params: DocAccessRequestsAPIParams,
  queryConfig?: UseQueryOptions<
    AccessRequestResponse,
    APIError,
    AccessRequestResponse
  >,
) {
  return useQuery<AccessRequestResponse, APIError, AccessRequestResponse>({
    queryKey: [KEY_LIST_DOC_ACCESS_REQUESTS, params],
    queryFn: () => getDocAccessRequests(params),
    ...queryConfig,
  });
}

export const useDocAccessRequestsInfinite = (
  params: DocAccessRequestsParams,
) => {
  return useAPIInfiniteQuery(
    KEY_LIST_DOC_ACCESS_REQUESTS,
    getDocAccessRequests,
    params,
  );
};

interface acceptDocAccessRequestsParams {
  docId: string;
  accessRequestId: string;
  role: Role;
}

export const acceptDocAccessRequests = async ({
  docId,
  accessRequestId,
  role,
}: acceptDocAccessRequestsParams): Promise<void> => {
  const response = await fetchAPI(
    `documents/${docId}/ask-for-access/${accessRequestId}/accept/`,
    {
      method: 'POST',
      body: JSON.stringify({
        role,
      }),
    },
  );

  if (!response.ok) {
    throw new APIError(
      'Failed to accept the access request',
      await errorCauses(response),
    );
  }
};

type UseAcceptDocAccessRequests = Partial<AccessRequest>;

type UseAcceptDocAccessRequestsOptions = UseMutationOptions<
  void,
  APIError,
  UseAcceptDocAccessRequests
>;

export const useAcceptDocAccessRequest = (
  options?: UseAcceptDocAccessRequestsOptions,
) => {
  const queryClient = useQueryClient();

  return useMutation<void, APIError, acceptDocAccessRequestsParams>({
    mutationFn: acceptDocAccessRequests,
    ...options,
    onSuccess: (data, variables, context) => {
      void queryClient.invalidateQueries({
        queryKey: [KEY_LIST_DOC_ACCESSES],
      });

      void queryClient.invalidateQueries({
        queryKey: [KEY_LIST_DOC_ACCESS_REQUESTS],
      });

      if (options?.onSuccess) {
        void options.onSuccess(data, variables, context);
      }
    },
  });
};

interface DeleteDocAccessRequestParams {
  docId: string;
  accessRequestId: string;
}

export const deleteDocAccessRequest = async ({
  docId,
  accessRequestId,
}: DeleteDocAccessRequestParams): Promise<void> => {
  const response = await fetchAPI(
    `documents/${docId}/ask-for-access/${accessRequestId}/`,
    {
      method: 'DELETE',
    },
  );

  if (!response.ok) {
    throw new APIError(
      'Failed to delete the access request',
      await errorCauses(response),
    );
  }
};

type UseDeleteDocAccessRequestOptions = UseMutationOptions<
  void,
  APIError,
  DeleteDocAccessRequestParams
>;

export const useDeleteDocAccessRequest = (
  options?: UseDeleteDocAccessRequestOptions,
) => {
  const queryClient = useQueryClient();

  return useMutation<void, APIError, DeleteDocAccessRequestParams>({
    mutationFn: deleteDocAccessRequest,
    ...options,
    onSuccess: (data, variables, context) => {
      void queryClient.invalidateQueries({
        queryKey: [KEY_LIST_DOC_ACCESS_REQUESTS],
      });

      if (options?.onSuccess) {
        void options.onSuccess(data, variables, context);
      }
    },
  });
};
