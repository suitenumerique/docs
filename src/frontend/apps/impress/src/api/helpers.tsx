import {
  DefinedInitialDataInfiniteOptions,
  InfiniteData,
  QueryKey,
  UseQueryOptions,
  useInfiniteQuery,
} from '@tanstack/react-query';

import { APIError } from './APIError';
import { APIList } from './types';

export type UseQueryOptionsAPI<Q> = UseQueryOptions<Q, APIError, Q>;
export type DefinedInitialDataInfiniteOptionsAPI<
  Q,
  TPageParam = number,
> = DefinedInitialDataInfiniteOptions<
  Q,
  APIError,
  InfiniteData<Q>,
  QueryKey,
  TPageParam
>;

export type InfiniteQueryConfig<Q> = Omit<
  DefinedInitialDataInfiniteOptionsAPI<Q>,
  'queryKey' | 'initialData' | 'getNextPageParam' | 'initialPageParam'
>;

/**
 * @param param Used for infinite scroll pagination
 * @param queryConfig
 * @returns
 */
export const useAPIInfiniteQuery = <T, Q extends { next?: APIList<Q>['next'] }>(
  key: string,
  api: (props: T & { page: number }) => Promise<Q>,
  param: T,
  queryConfig?: InfiniteQueryConfig<Q>,
) => {
  return useInfiniteQuery<Q, APIError, InfiniteData<Q>, QueryKey, number>({
    initialPageParam: 1,
    queryKey: [key, param],
    queryFn: ({ pageParam }) =>
      api({
        ...param,
        page: pageParam,
      }),
    getNextPageParam(lastPage, allPages) {
      return lastPage.next ? allPages.length + 1 : undefined;
    },
    ...queryConfig,
  });
};
