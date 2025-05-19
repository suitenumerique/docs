import { UseQueryOptions, useQuery } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

import { Access } from '@/docs/doc-management';

export type DocAccessesParams = {
  docId: string;
  ordering?: string;
};

export type DocAccessesAPIParams = DocAccessesParams & {};

export const getDocAccesses = async ({
  docId,
  ordering,
}: DocAccessesAPIParams): Promise<Access[]> => {
  let url = `documents/${docId}/accesses/`;

  if (ordering) {
    url += '&ordering=' + ordering;
  }

  const response = await fetchAPI(url);

  if (!response.ok) {
    throw new APIError(
      'Failed to get the doc accesses',
      await errorCauses(response),
    );
  }

  return (await response.json()) as Access[];
};

export const KEY_LIST_DOC_ACCESSES = 'docs-accesses';

export function useDocAccesses(
  params: DocAccessesAPIParams,
  queryConfig?: UseQueryOptions<Access[], APIError, Access[]>,
) {
  return useQuery<Access[], APIError, Access[]>({
    queryKey: [KEY_LIST_DOC_ACCESSES, params],
    queryFn: () => getDocAccesses(params),
    ...queryConfig,
  });
}
