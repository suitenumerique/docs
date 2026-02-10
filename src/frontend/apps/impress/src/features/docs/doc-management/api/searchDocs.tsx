import { useQuery } from '@tanstack/react-query';

import { APIError, APIList, errorCauses, fetchAPI } from '@/api';
import { KEY_LIST_DOC } from '@/docs/doc-management';

import { Doc } from '../types';

export type DocsParams = {
  q: string;
};

export const constructParams = (params: DocsParams): URLSearchParams => {
  const searchParams = new URLSearchParams();

  if (params.q.length > 0) {
    searchParams.set('q', params.q);
  } else {
    searchParams.set('q', '*');
  }

  return searchParams;
};

export type DocsResponse = APIList<Doc>;
export const getDocs = async (params: DocsParams): Promise<DocsResponse> => {
  const searchParams = constructParams(params);
  const response = await fetchAPI(
    `documents/search/?${searchParams.toString()}`,
  );

  if (!response.ok) {
    throw new APIError('Failed to get the docs', await errorCauses(response));
  }

  return response.json() as Promise<DocsResponse>;
};

export const useSearchDocs = (params: DocsParams) => {
  return useQuery<DocsResponse, APIError, DocsResponse>({
    queryKey: [KEY_LIST_DOC, 'search', params],
    queryFn: () => getDocs(params),
  });
};
