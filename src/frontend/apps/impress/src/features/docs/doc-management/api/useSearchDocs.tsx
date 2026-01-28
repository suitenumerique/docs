import { useQuery } from '@tanstack/react-query';

import {
  APIError,
  APIList,
  errorCauses,
  fetchAPI,
  useAPIInfiniteQuery,
} from '@/api';
import { KEY_LIST_DOC } from '@/docs/doc-management';
import { DocSearchTarget } from '@/docs/doc-search';

import { Doc } from '../types';

export type DocsParams = {
  page: number;
  q: string;
  target?: DocSearchTarget;
  parentPath?: string;
};

export const constructParams = ({
  q,
  page,
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
  if (page) {
    searchParams.set('page', page.toString());
  }

  return searchParams;
};

export type DocsResponse = APIList<Doc>;
export const searchDocs = async ({
  q,
  page,
  target,
  parentPath,
}: DocsParams): Promise<DocsResponse> => {
  const searchParams = constructParams({ q, page, target, parentPath });
  const response = await fetchAPI(
    `documents/search/?${searchParams.toString()}`,
  );

  if (!response.ok) {
    throw new APIError('Failed to get the docs', await errorCauses(response));
  }

  return response.json() as Promise<DocsResponse>;
};

export const useSearchDocs = (
  { q, page, target, parentPath }: DocsParams,
  queryConfig?: { enabled?: boolean },
) => {
  return useQuery<DocsResponse, APIError, DocsResponse>({
    queryKey: [KEY_LIST_DOC, 'search', { q, page, target, parentPath }],
    queryFn: () => searchDocs({ q, page, target, parentPath }),
    ...queryConfig,
  });
};

export const useInfiniteSearchDocs = (
  params: DocsParams,
  queryConfig?: { enabled?: boolean },
) => {
  return useAPIInfiniteQuery(KEY_LIST_DOC, searchDocs, params, queryConfig);
};
