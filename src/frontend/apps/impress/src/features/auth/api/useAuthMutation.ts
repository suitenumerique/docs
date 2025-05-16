import { useMutation, useQueryClient } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

import { User } from './types';
import { KEY_AUTH } from './useAuthQuery';

// Mutations are separated from queries to allow for better separation of concerns.
// Mutations are responsible for C (CREATE), U (UPDATE), and D (DELETE) in CRUD.

// --- Create ---
function createUser(): Promise<User> {
  throw new Error('Not yet implemented.');
}

// --- Update ---
async function updateUser(
  user: { id: User['id'] } & Partial<Omit<User, 'id'>>,
): Promise<User> {
  const response = await fetchAPI(`users/${user.id}/`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(user),
  });
  if (!response.ok) {
    throw new APIError(
      `Failed to update user profile for user ${user.id}`,
      await errorCauses(response, user),
    );
  }
  return response.json() as Promise<User>;
}

// --- Delete ---
function deleteUser(): Promise<User> {
  throw new Error('Not yet implemented.');
}

// NOTE: Consider renaming useAuthMutation to useUserMutation for clarity.
export function useAuthMutation() {
  const queryClient = useQueryClient();

  const createMutation = useMutation<User, APIError, User>({
    mutationFn: createUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [KEY_AUTH] });
    },
    onError: (error) => {
      console.error('Error creating user', error);
    },
  });

  const updateMutation = useMutation<User, APIError, User>({
    mutationFn: updateUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [KEY_AUTH] });
    },
    onError: (error) => {
      console.error('Error updating user', error);
    },
  });

  const deleteMutation = useMutation<User, APIError, User>({
    mutationFn: deleteUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [KEY_AUTH] });
    },
    onError: (error) => {
      console.error('Error deleting user', error);
    },
  });

  return {
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
  };
}
