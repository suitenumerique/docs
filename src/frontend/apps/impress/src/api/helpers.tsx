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
 * Custom React hook that wraps React Query's `useInfiniteQuery` for paginated API requests.
 *
 * @template T - Type of the request parameters.
 * @template Q - Type of the API response, which must include an optional `next` field for pagination.
 *
 * @param {string} key - Unique key to identify the query in the cache.
 * @param {(props: T & { page: number }) => Promise<Q>} api - Function that fetches paginated data from the API. It receives the params merged with a page number.
 * @param {T} param - Static parameters to send with every API request (excluding the page number).
 * @param {DefinedInitialDataInfiniteOptionsAPI<Q>} [queryConfig] - Optional configuration passed to `useInfiniteQuery` (e.g., stale time, cache time).
 *
 * @returns Return value of `useInfiniteQuery`, including data, loading state, fetchNextPage, etc.
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
