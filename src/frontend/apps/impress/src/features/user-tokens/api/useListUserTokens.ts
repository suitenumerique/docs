import { useQuery } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

import { UserToken } from '../types';

export const listUserTokens = async (): Promise<UserToken[]> => {
  const response = await fetchAPI(`user-tokens/`);

  if (!response.ok) {
    throw new APIError(
      'Failed to list user tokens',
      await errorCauses(response),
    );
  }

  return response.json() as Promise<UserToken[]>;
};

export function useListUserTokens() {
  return useQuery<UserToken[], APIError>({
    queryKey: ['userTokens'],
    queryFn: listUserTokens,
  });
}
