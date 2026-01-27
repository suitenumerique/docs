import { useQuery } from '@tanstack/react-query';

import {
  APIError,
  APIList,
  errorCauses,
  fetchAPI,
  useAPIInfiniteQuery,
} from '@/api';
import { Doc } from '@/docs/doc-management';
import { DocSearchTarget } from '@/docs/doc-search';

export type SearchDocsParams = {
  page: number;
  q: string;
  target?: DocSearchTarget;
  parentPath?: string;
};

const constructParams = ({
  q,
  page,
  target,
  parentPath,
}: SearchDocsParams): URLSearchParams => {
  const searchParams = new URLSearchParams();

  searchParams.set('q', q);

  if (target === DocSearchTarget.CURRENT && parentPath) {
    searchParams.set('path', parentPath);
  }
  if (page) {
    searchParams.set('page', page.toString());
  }

  return searchParams;
};

const searchDocs = async ({
  q,
  page,
  target,
  parentPath,
}: SearchDocsParams): Promise<APIList<Doc>> => {
  const searchParams = constructParams({ q, page, target, parentPath });
  const response = await fetchAPI(
    `documents/search/?${searchParams.toString()}`,
  );

  if (!response.ok) {
    throw new APIError('Failed to get the docs', await errorCauses(response));
  }

  return response.json() as Promise<APIList<Doc>>;
};

export const KEY_LIST_SEARCH_DOC = 'search-docs';

export const useSearchDocs = (
  { q, page, target, parentPath }: SearchDocsParams,
  queryConfig?: { enabled?: boolean },
) => {
  return useQuery<APIList<Doc>, APIError, APIList<Doc>>({
    queryKey: [KEY_LIST_SEARCH_DOC, 'search', { q, page, target, parentPath }],
    queryFn: () => searchDocs({ q, page, target, parentPath }),
    ...queryConfig,
  });
};

export const useInfiniteSearchDocs = (
  params: SearchDocsParams,
  queryConfig?: { enabled?: boolean },
) => {
  return useAPIInfiniteQuery(
    KEY_LIST_SEARCH_DOC,
    searchDocs,
    params,
    queryConfig,
  );
};
