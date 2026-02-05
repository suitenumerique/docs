import { useQuery } from '@tanstack/react-query';

import { APIError, UseQueryOptionsAPI, errorCauses, fetchAPI } from '@/api';

import { Version } from '../types';

export type DocVersionParam = {
  docId: string;
  versionId: string;
};

const getDocVersion = async ({
  versionId,
  docId,
}: DocVersionParam): Promise<Version> => {
  const response = await fetchAPI(`documents/${docId}/versions/${versionId}/`);

  if (!response.ok) {
    throw new APIError(
      'Failed to get the doc version',
      await errorCauses(response),
    );
  }

  return response.json() as Promise<Version>;
};

export const KEY_DOC_VERSION = 'doc-version';

export function useDocVersion(
  params: DocVersionParam,
  queryConfig?: UseQueryOptionsAPI<Version>,
) {
  return useQuery<Version, APIError, Version>({
    queryKey: [KEY_DOC_VERSION, params],
    queryFn: () => getDocVersion(params),
    ...queryConfig,
  });
}
