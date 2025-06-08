import {
  UseMutationResult,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { User } from '@/features/auth/api/types';
import { KEY_AUTH } from '@/features/auth/api/useAuthQuery';

type UserUpdateRequest = Partial<User>;

async function updateUser(userUpdateData: UserUpdateRequest): Promise<User> {
  const response = await fetchAPI(`users/${userUpdateData.id}/`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userUpdateData),
  });
  if (!response.ok) {
    throw new APIError(
      `Failed to update the user`,
      await errorCauses(response, userUpdateData),
    );
  }
  return response.json() as Promise<User>;
}

export const useUserUpdate = (): UseMutationResult<
  User,
  APIError,
  UserUpdateRequest
> => {
  const queryClient = useQueryClient();

  const mutationResult = useMutation<User, APIError, UserUpdateRequest>({
    mutationFn: updateUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [KEY_AUTH] });
    },
    onError: (error) => {
      console.error('Error updating user', error);
    },
  });

  return mutationResult;
};
