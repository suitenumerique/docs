import { CunninghamProvider } from '@openfun/cunningham-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useCunninghamTheme } from '@/cunningham';
import '@/i18n/initI18n';
import { PostHogProvider } from '@/services/Posthog';
import { useResponsiveStore } from '@/stores/';

import { Auth } from './auth/';
import { ConfigProvider } from './config/';

/**
 * QueryClient:
 *  - defaultOptions:
 *    - staleTime:
 *      - global cache duration - we decided 3 minutes
 *      - It can be overridden to each query
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 3,
      retry: 1,
    },
  },
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useCunninghamTheme();

  const initializeResizeListener = useResponsiveStore(
    (state) => state.initializeResizeListener,
  );

  useEffect(() => {
    const cleanupResizeListener = initializeResizeListener();
    return cleanupResizeListener;
  }, [initializeResizeListener]);

  return (
    <PostHogProvider>
      <QueryClientProvider client={queryClient}>
        <CunninghamProvider theme={theme}>
          <ConfigProvider>
            <Auth>{children}</Auth>
          </ConfigProvider>
        </CunninghamProvider>
      </QueryClientProvider>
    </PostHogProvider>
  );
}
