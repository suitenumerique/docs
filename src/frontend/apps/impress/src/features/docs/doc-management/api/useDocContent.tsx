import { UseQueryOptions, useQuery } from '@tanstack/react-query';
import { validate as uuidValidate } from 'uuid';

import { APIError, errorCauses, fetchAPI } from '@/api';

export type DocContentParams = {
  id: string;
};

export const getDocContent = async ({
  id,
}: DocContentParams): Promise<string> => {
  if (!uuidValidate(id)) {
    throw new Error(`Invalid doc id in getDocContent: ${id}`);
  }

  const response = await fetchAPI(`documents/${id}/content/`, {
    headers: {
      accept: 'text/plain,application/json',
    },
  });

  if (!response.ok) {
    throw new APIError('Failed to get the doc', await errorCauses(response));
  }

  return response.text();
};

export const KEY_DOC_CONTENT = 'doc-content';

export function useDocContent(
  param: DocContentParams,
  queryConfig?: UseQueryOptions<string, APIError, string>,
) {
  return useQuery<string, APIError, string>({
    queryKey: queryConfig?.queryKey ?? [KEY_DOC_CONTENT, param],
    queryFn: () => getDocContent(param),
    ...queryConfig,
  });
}
