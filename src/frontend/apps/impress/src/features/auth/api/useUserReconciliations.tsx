import { UseQueryOptions, useQuery } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

type UserReconciliationResponse = {
  details: string;
};

interface UserReconciliationProps {
  type: 'active' | 'inactive';
  reconciliationId?: string;
}

export const userReconciliations = async ({
  type,
  reconciliationId,
}: UserReconciliationProps): Promise<UserReconciliationResponse> => {
  const response = await fetchAPI(
    `user_reconciliations/${type}/${reconciliationId}/`,
  );

  if (!response.ok) {
    throw new APIError(
      'Failed to do the user reconciliation',
      await errorCauses(response),
    );
  }

  return response.json() as Promise<UserReconciliationResponse>;
};

export const KEY_USER_RECONCILIATIONS = 'user_reconciliations';

export function useUserReconciliationsQuery(
  param: UserReconciliationProps,
  queryConfig?: UseQueryOptions<
    UserReconciliationResponse,
    APIError,
    UserReconciliationResponse
  >,
) {
  return useQuery<
    UserReconciliationResponse,
    APIError,
    UserReconciliationResponse
  >({
    queryKey: [KEY_USER_RECONCILIATIONS, param],
    queryFn: () => userReconciliations(param),
    ...queryConfig,
  });
}
