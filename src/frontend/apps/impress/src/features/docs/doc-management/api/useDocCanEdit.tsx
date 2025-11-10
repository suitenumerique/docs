import { UseQueryOptions, useQuery } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

type DocCanEditResponse = { can_edit: boolean };

export const docCanEdit = async (id: string): Promise<DocCanEditResponse> => {
  const response = await fetchAPI(`documents/${id}/can-edit/`);

  if (!response.ok) {
    throw new APIError('Failed to get the doc', await errorCauses(response));
  }

  return response.json() as Promise<DocCanEditResponse>;
};

export const KEY_CAN_EDIT = 'doc-can-edit';

export function useDocCanEdit(
  param: string,
  queryConfig?: UseQueryOptions<
    DocCanEditResponse,
    APIError,
    DocCanEditResponse
  >,
) {
  return useQuery<DocCanEditResponse, APIError, DocCanEditResponse>({
    queryKey: [KEY_CAN_EDIT, param],
    queryFn: () => docCanEdit(param),
    ...queryConfig,
  });
}
