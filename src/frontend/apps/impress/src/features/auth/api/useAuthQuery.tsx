import { UseQueryOptions, useQuery } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { DEFAULT_QUERY_RETRY } from '@/core';

import { User } from './types';

type UserResponse = User | null;

/**
 * Asynchronously retrieves the current user's data from the API.
 * This function is called during frontend initialization to check
 * the user's authentication status through a session cookie.
 *
 * @async
 * @function getMe
 * @throws {Error} Throws an error if the API request fails.
 * @returns {Promise<User>} A promise that resolves to the user data.
 */
export const getMe = async (): Promise<UserResponse> => {
  const response = await fetchAPI(`users/me/`);

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new APIError(
      `Couldn't fetch user data: ${response.statusText}`,
      await errorCauses(response),
    );
  }
  return response.json() as Promise<User>;
};

export const KEY_AUTH = 'auth';

export function useAuthQuery(
  queryConfig?: UseQueryOptions<UserResponse, APIError, UserResponse>,
) {
  return useQuery<UserResponse, APIError, UserResponse>({
    queryKey: [KEY_AUTH],
    queryFn: getMe,
    staleTime: 1000 * 60 * 15, // 15 minutes
    retry: (failureCount, error) => {
      // we assume that a 401 means the user is not logged in
      if (error.status == 401) {
        return false;
      }
      return failureCount < DEFAULT_QUERY_RETRY;
    },
    ...queryConfig,
  });
}
