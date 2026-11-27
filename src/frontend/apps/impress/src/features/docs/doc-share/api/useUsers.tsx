import { UseQueryOptions, useQuery } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { Doc } from '@/docs/doc-management';
import { User } from '@/features/auth';

export type UsersParams = {
  query: string;
  docId: Doc['id'];
};

type UsersResponse = User[];

export const getUsers = async ({
  query,
  docId,
}: UsersParams): Promise<UsersResponse> => {
  const queriesParams = [];
  queriesParams.push(query ? `q=${encodeURIComponent(query)}` : '');
  queriesParams.push(docId ? `document_id=${docId}` : '');
  const queryParams = queriesParams.filter(Boolean).join('&');

  const response = await fetchAPI(`users/?${queryParams}`);

  if (!response.ok) {
    throw new APIError('Failed to get the users', await errorCauses(response));
  }

  const users = (await response.json()) as UsersResponse;

  // Users without an email cannot be invited, and the share modal assumes
  // every search result has one.
  return users.filter((user) => user.email);
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
