import {
  DefinedInitialDataInfiniteOptions,
  InfiniteData,
  QueryKey,
  useInfiniteQuery,
} from '@tanstack/react-query';

import { APIError, APIList, errorCauses, fetchAPI } from '@/api';

import { Template } from '../types';

export enum TemplatesOrdering {
  BY_CREATED_ON = 'created_at',
  BY_CREATED_ON_DESC = '-created_at',
}

export type TemplatesParams = {
  ordering: TemplatesOrdering;
};
type TemplatesAPIParams = TemplatesParams & {
  page: number;
};

type TemplatesResponse = APIList<Template>;

export const getTemplates = async ({
  ordering,
  page,
}: TemplatesAPIParams): Promise<TemplatesResponse> => {
  const orderingQuery = ordering ? `&ordering=${ordering}` : '';
  const response = await fetchAPI(`templates/?page=${page}${orderingQuery}`);

  if (!response.ok) {
    throw new APIError(
      'Failed to get the templates',
      await errorCauses(response),
    );
  }

  return response.json() as Promise<TemplatesResponse>;
};

export const KEY_LIST_TEMPLATE = 'templates';

export function useTemplates(
  param: TemplatesParams,
  queryConfig?: DefinedInitialDataInfiniteOptions<
    TemplatesResponse,
    APIError,
    InfiniteData<TemplatesResponse>,
    QueryKey,
    number
  >,
) {
  return useInfiniteQuery<
    TemplatesResponse,
    APIError,
    InfiniteData<TemplatesResponse>,
    QueryKey,
    number
  >({
    initialPageParam: 1,
    queryKey: [KEY_LIST_TEMPLATE, param],
    queryFn: ({ pageParam }) =>
      getTemplates({
        ...param,
        page: pageParam,
      }),
    getNextPageParam(lastPage, allPages) {
      return lastPage.next ? allPages.length + 1 : undefined;
    },
    ...queryConfig,
  });
}
