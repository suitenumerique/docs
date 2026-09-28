import {
  CunninghamProvider,
  TreeProvider,
} from '@gouvfr-lasuite/ui-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PropsWithChildren } from 'react';

import '@/i18n/initI18n';

export const AppWrapper = ({ children }: PropsWithChildren) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return (
    <CunninghamProvider theme="default">
      <TreeProvider initialTreeData={[]}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </TreeProvider>
    </CunninghamProvider>
  );
};
