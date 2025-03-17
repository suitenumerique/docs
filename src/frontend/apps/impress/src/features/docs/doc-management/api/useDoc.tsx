import { UseQueryOptions, useQuery } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

import { Doc } from '../types';

export type DocParams = {
  id: string;
};

export const getDoc = async ({ id }: DocParams): Promise<Doc> => {
  const response = await fetchAPI(`documents/${id}/`);

  if (!response.ok) {
    throw new APIError('Failed to get the doc', await errorCauses(response));
  }

  return response.json() as Promise<Doc>;
};

export const KEY_DOC = 'doc';
export const KEY_SUB_PAGE = 'sub-page';
export const KEY_DOC_VISIBILITY = 'doc-visibility';

export function useDoc(
  param: DocParams,
  queryConfig?: UseQueryOptions<Doc, APIError, Doc>,
) {
  return useQuery<Doc, APIError, Doc>({
    queryKey: queryConfig?.queryKey ?? [KEY_DOC, param],
    queryFn: () => getDoc(param),
    ...queryConfig,
  });
}
