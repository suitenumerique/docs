import { useQuery } from '@tanstack/react-query';

import { APIError, APIList, errorCauses, fetchAPI } from '@/api';
import { KEY_LIST_DOC } from '@/docs/doc-management';
import { DocSearchTarget } from '@/docs/doc-search';

import { Doc } from '../types';

export type DocsParams = {
  q: string;
  target?: DocSearchTarget;
  parentPath?: string;
};

export const constructParams = ({
  q,
  target,
  parentPath,
}: DocsParams): URLSearchParams => {
  const searchParams = new URLSearchParams();

  if (q.length > 0) {
    searchParams.set('q', q);
  } else {
    searchParams.set('q', '*');
  }
  if (target === DocSearchTarget.CURRENT && parentPath) {
    searchParams.set('path', parentPath);
  }

  return searchParams;
};

export type DocsResponse = APIList<Doc>;
export const getDocs = async ({
  q,
  target,
  parentPath,
}: DocsParams): Promise<DocsResponse> => {
  const searchParams = constructParams({ q, target, parentPath });
  const response = await fetchAPI(
    `documents/search/?${searchParams.toString()}`,
  );

  if (!response.ok) {
    throw new APIError('Failed to get the docs', await errorCauses(response));
  }

  return response.json() as Promise<DocsResponse>;
};

export const useSearchDocs = ({ q, target, parentPath }: DocsParams) => {
  return useQuery<DocsResponse, APIError, DocsResponse>({
    queryKey: [KEY_LIST_DOC, 'search', { q, target, parentPath }],
    queryFn: () => getDocs({ q, target, parentPath }),
  });
};
