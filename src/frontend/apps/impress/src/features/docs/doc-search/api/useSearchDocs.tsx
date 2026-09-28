import { useQuery } from '@tanstack/react-query';

import {
  APIError,
  APIList,
  errorCauses,
  fetchAPI,
  useAPIInfiniteQuery,
} from '@/api';
import { Doc } from '@/docs/doc-management';

import { DocSearchFilterTypes } from '../types';

export type SearchDocsParams = {
  page: number;
  q: string;
  filter?: DocSearchFilterTypes;
  parentDocId?: string;
};

const constructParams = ({
  q,
  page,
  filter,
  parentDocId,
}: SearchDocsParams): URLSearchParams => {
  const searchParams = new URLSearchParams();

  searchParams.set('q', q);

  if (filter === 'current' && parentDocId) {
    searchParams.set('document', parentDocId);
  }
  if (page) {
    searchParams.set('page', page.toString());
  }

  return searchParams;
};

export type DocSearch = Doc & {
  parent: Doc | null;
};

type SearchDocsResponse = APIList<DocSearch>;

const searchDocs = async ({
  q,
  page,
  filter,
  parentDocId,
}: SearchDocsParams): Promise<SearchDocsResponse> => {
  const searchParams = constructParams({ q, page, filter, parentDocId });
  const response = await fetchAPI(
    `documents/search/?${searchParams.toString()}`,
  );

  if (!response.ok) {
    throw new APIError('Failed to get the docs', await errorCauses(response));
  }

  return response.json() as Promise<SearchDocsResponse>;
};

export const KEY_LIST_SEARCH_DOC = 'search-docs';

export const useSearchDocs = (
  param: SearchDocsParams,
  queryConfig?: { enabled?: boolean },
) => {
  return useQuery<SearchDocsResponse, APIError, SearchDocsResponse>({
    queryKey: [KEY_LIST_SEARCH_DOC, param],
    queryFn: () => searchDocs(param),
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
