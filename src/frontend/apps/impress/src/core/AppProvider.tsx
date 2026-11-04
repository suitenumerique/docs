import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

import { APIError } from '@/api';
import { Auth, KEY_AUTH, setAuthUrl } from '@/features/auth';
import { useRouteChangeCompleteFocus } from '@/hooks/useRouteChangeCompleteFocus';
import { useResponsiveStore } from '@/stores/';

import { ConfigProvider } from './config/';
import { ThemeProvider } from './config/ThemeProvider';

export const DEFAULT_QUERY_RETRY = 1;

/**
 * A 401, 403 or 404 answer will not change on a second attempt, so only the
 * other errors (network, 5xx...) are retried.
 */
export const defaultQueryRetry = (failureCount: number, error: unknown) => {
  if (error instanceof APIError && [401, 403, 404].includes(error.status)) {
    return false;
  }
  return failureCount < DEFAULT_QUERY_RETRY;
};

/**
 * QueryClient:
 *  - defaultOptions:
 *    - staleTime:
 *      - global cache duration - we decided 3 minutes
 *      - It can be overridden to each query
 *    - retry:
 *      - no retry on 401, 403 and 404, one retry otherwise
 *      - It can be overridden to each query
 */
export const defaultOptions = {
  queries: {
    staleTime: 1000 * 60 * 3,
    retry: defaultQueryRetry,
  },
};

let globalRouterReplace: ((url: string) => void) | null = null;

const queryClient = new QueryClient({
  defaultOptions,
  mutationCache: new MutationCache({
    onError: (error) => {
      if (error instanceof Error && 'status' in error && error.status === 401) {
        void queryClient.resetQueries({
          queryKey: [KEY_AUTH],
        });
        setAuthUrl();
        if (globalRouterReplace) {
          void globalRouterReplace('/401');
        }
      }
    },
  }),
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { replace } = useRouter();
  useRouteChangeCompleteFocus();

  const initializeResizeListener = useResponsiveStore(
    (state) => state.initializeResizeListener,
  );

  useEffect(() => {
    return initializeResizeListener();
  }, [initializeResizeListener]);

  /**
   * Update the global router replace function
   * This allows us to use the router replace function globally
   */
  useEffect(() => {
    globalRouterReplace = (url: string) => {
      void replace(url);
    };
  }, [replace]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ConfigProvider>
          <Auth>{children}</Auth>
        </ConfigProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
