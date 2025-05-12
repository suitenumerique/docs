import { CunninghamProvider } from '@openfun/cunningham-react';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import type { Persister } from '@tanstack/react-query-persist-client';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import debug from 'debug';
import { useRouter } from 'next/router';
import { useEffect, useMemo } from 'react';

import { useCunninghamTheme } from '@/cunningham';
import { Auth, KEY_AUTH, setAuthUrl } from '@/features/auth';
import { useResponsiveStore } from '@/stores/';

import { ConfigProvider } from './config/';

/**
 * QueryClient:
 *  - defaultOptions:
 *    - staleTime:
 *      - global cache duration - we decided 3 minutes
 *      - It can be overridden to each query
 */
const defaultOptions = {
  queries: {
    staleTime: debug.enabled('no-cache') ? 0 : 1000 * 60 * 3, // 3 minutes
    staleTime: 1000 * 60 * 3,
    retry: 1,
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

  const persister = useMemo(() => {
    // Create persister only when the browser is available
    if (typeof window !== 'undefined') {
      return createSyncStoragePersister({
        storage: window.localStorage,
      });
    }
    // Return undefined otherwise (PersistQueryClientProvider handles undefined persister gracefully)
    return undefined;
  }, []);

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
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: persister as Persister }}
    >
      <CunninghamProvider theme={theme}>
        <ConfigProvider>
          <Auth>{children}</Auth>
        </ConfigProvider>
      </CunninghamProvider>
    </PersistQueryClientProvider>
  );
}
