import { useMutation } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

import { NewUserToken } from '../types';

export const createUserToken = async (): Promise<NewUserToken> => {
  const response = await fetchAPI(`user-tokens/`, {
    method: 'POST',
    // The backend test indicates no data is sent for creation, so body is an empty object
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new APIError(
      'Failed to create user token',
      await errorCauses(response),
    );
  }

  return response.json() as Promise<NewUserToken>;
};

export function useCreateUserToken() {
  return useMutation<NewUserToken, APIError>({
    mutationFn: createUserToken,
  });
}
