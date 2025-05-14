import { useMutation } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

export const deleteUserToken = async (digest: string): Promise<void> => {
  const response = await fetchAPI(`user-tokens/${digest}/`, {
    method: 'DELETE',
  });

  if (!response.ok && response.status !== 204) {
    // 204 is a valid response for delete
    throw new APIError(
      'Failed to delete user token',
      await errorCauses(response),
    );
  }
  // For 204, there's no content, and for other successful deletions, we don't expect content.
  // So, we don't try to parse JSON.
  return Promise.resolve();
};

export type DeleteUserTokenParams = {
  digest: string;
};

export function useDeleteUserToken() {
  return useMutation<void, APIError, DeleteUserTokenParams>({
    mutationFn: ({ digest }) => deleteUserToken(digest),
  });
}
