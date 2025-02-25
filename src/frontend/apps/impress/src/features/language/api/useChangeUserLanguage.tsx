import { useMutation, useQueryClient } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { User } from '@/features/auth/api/types';

export interface ChangeUserLanguageParams {
  userId: User['id'];
  language: User['language'];
}

export const changeUserLanguage = async ({
  userId,
  language,
}: ChangeUserLanguageParams): Promise<User> => {
  const response = await fetchAPI(`users/${userId}/`, {
    method: 'PATCH',
    body: JSON.stringify({
      language,
    }),
  });

  if (!response.ok) {
    throw new APIError(
      `Failed to change the user language to ${language}`,
      await errorCauses(response, {
        value: language,
        type: 'language',
      }),
    );
  }

  return response.json() as Promise<User>;
};

export function useChangeUserLanguage() {
  const queryClient = useQueryClient();
  return useMutation<User, APIError, ChangeUserLanguageParams>({
    mutationFn: changeUserLanguage,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['change-user-language'],
      });
    },
  });
}
