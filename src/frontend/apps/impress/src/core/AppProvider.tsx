import { CunninghamProvider } from '@openfun/cunningham-react';
import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
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
  const { theme } = useCunninghamTheme();
  const { replace } = useRouter();

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
      <CunninghamProvider theme={theme}>
        <ConfigProvider>
          <Auth>{children}</Auth>
        </ConfigProvider>
      </CunninghamProvider>
    </QueryClientProvider>
  );
}
