import { UseQueryOptions, useQuery } from '@tanstack/react-query';

import { APIError, APIList, errorCauses, fetchAPI } from '@/api';
import { User } from '@/core/auth';
import { Doc } from '@/features/docs/doc-management';

export type UsersParams = {
  query: string;
  docId: Doc['id'];
};

type UsersResponse = APIList<User>;

export const getUsers = async ({
  query,
  docId,
}: UsersParams): Promise<UsersResponse> => {
  const queriesParams = [];
  queriesParams.push(query ? `q=${query}` : '');
  queriesParams.push(docId ? `document_id=${docId}` : '');
  const queryParams = queriesParams.filter(Boolean).join('&');

  const response = await fetchAPI(`users/?${queryParams}`);

  if (!response.ok) {
    throw new APIError('Failed to get the users', await errorCauses(response));
  }

  return response.json() as Promise<UsersResponse>;
};

export const KEY_LIST_USER = 'users';

export function useUsers(
  param: UsersParams,
  queryConfig?: UseQueryOptions<UsersResponse, APIError, UsersResponse>,
) {
  return useQuery<UsersResponse, APIError, UsersResponse>({
    queryKey: [KEY_LIST_USER, param],
    queryFn: () => getUsers(param),
    ...queryConfig,
  });
}
