import { CunninghamProvider } from '@openfun/cunningham-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

import { useCunninghamTheme } from '@/cunningham';
import { Auth, KEY_AUTH, setAuthUrl } from '@/features/auth';
import { useResponsiveStore } from '@/stores/';

import { ConfigProvider } from './config/';

export const DEFAULT_QUERY_RETRY = 1;

/**
 * QueryClient:
 *  - defaultOptions:
 *    - staleTime:
 *      - global cache duration - we decided 3 minutes
 *      - It can be overridden to each query
 */
const defaultOptions = {
  queries: {
    staleTime: 1000 * 60 * 3,
    retry: DEFAULT_QUERY_RETRY,
  },
};
const queryClient = new QueryClient({
  defaultOptions,
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useCunninghamTheme();
  const { replace } = useRouter();

  const initializeResizeListener = useResponsiveStore(
    (state) => state.initializeResizeListener,
  );

  useEffect(() => {
    return initializeResizeListener();
  }, [initializeResizeListener]);

  useEffect(() => {
    queryClient.setDefaultOptions({
      ...defaultOptions,
      mutations: {
        onError: (error) => {
          if (
            error instanceof Error &&
            'status' in error &&
            error.status === 401
          ) {
            void queryClient.resetQueries({
              queryKey: [KEY_AUTH],
            });
            setAuthUrl();
            void replace(`/401`);
          }
        },
      },
    });
  }, [replace]);

  return (
    <QueryClientProvider client={queryClient}>
      <CunninghamProvider theme={theme}>
        <ConfigProvider>
          <Auth>{children}</Auth>
        </ConfigProvider>
      </CunninghamProvider>
    </QueryClientProvider>
  );
}
