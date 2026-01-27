import { useQuery } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI, useAPIInfiniteQuery } from '@/api';
import { DocSearchTarget } from '@/docs/doc-search';

import { DocsResponse, KEY_LIST_DOC } from './useDocs';

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
}: SearchDocsParams): Promise<DocsResponse> => {
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
  { q, page, target, parentPath }: SearchDocsParams,
  queryConfig?: { enabled?: boolean },
) => {
  return useQuery<DocsResponse, APIError, DocsResponse>({
    queryKey: [KEY_LIST_DOC, 'search', { q, page, target, parentPath }],
    queryFn: () => searchDocs({ q, page, target, parentPath }),
    ...queryConfig,
  });
};

export const useInfiniteSearchDocs = (
  params: SearchDocsParams,
  queryConfig?: { enabled?: boolean },
) => {
  return useAPIInfiniteQuery(KEY_LIST_DOC, searchDocs, params, queryConfig);
};
