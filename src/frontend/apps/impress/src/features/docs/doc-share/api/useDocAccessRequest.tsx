import {
  UseMutationOptions,
  UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { APIError, APIList, errorCauses, fetchAPI } from '@/api';
import { AccessRequest, Doc, Role } from '@/docs/doc-management';

import { OptionType } from '../types';

interface CreateDocAccessRequestParams {
  docId: Doc['id'];
  role?: Role;
}

export const createDocAccessRequest = async ({
  docId,
  role,
}: CreateDocAccessRequestParams): Promise<null> => {
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

  return null;
};

type UseCreateDocAccessRequestOptions = UseMutationOptions<
  null,
  APIError,
  CreateDocAccessRequestParams
>;

export function useCreateDocAccessRequest(
  options?: UseCreateDocAccessRequestOptions,
) {
  const queryClient = useQueryClient();

  return useMutation<null, APIError, CreateDocAccessRequestParams>({
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

interface GetDocAccessRequestsParams {
  docId: Doc['id'];
}

export const getDocAccessRequests = async ({
  docId,
}: GetDocAccessRequestsParams): Promise<AccessRequestResponse> => {
  const response = await fetchAPI(`documents/${docId}/ask-for-access/`);

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
  params: GetDocAccessRequestsParams,
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
