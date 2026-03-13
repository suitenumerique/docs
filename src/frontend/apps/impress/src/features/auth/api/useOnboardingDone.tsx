import {
  UseMutationOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

import { User } from './types';
import { KEY_AUTH } from './useAuthQuery';

type OnboardingDoneResponse = {
  detail: string;
};

export const onboardingDone = async (): Promise<OnboardingDoneResponse> => {
  const response = await fetchAPI(`users/onboarding-done/`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new APIError(
      'Failed to complete onboarding',
      await errorCauses(response),
    );
  }

  return response.json() as Promise<OnboardingDoneResponse>;
};

type UseOnboardingDoneOptions = UseMutationOptions<
  OnboardingDoneResponse,
  APIError
>;

export function useOnboardingDone(options?: UseOnboardingDoneOptions) {
  const queryClient = useQueryClient();
  return useMutation<OnboardingDoneResponse, APIError>({
    mutationFn: onboardingDone,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData<User>([KEY_AUTH], (oldData) => {
        if (!oldData) {
          return oldData;
        }
        return {
          ...oldData,
          is_first_connection: false,
        };
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
