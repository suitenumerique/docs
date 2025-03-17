import { TreeProvider } from '@gouvfr-lasuite/ui-kit';
import { CunninghamProvider } from '@openfun/cunningham-react';
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
    <TreeProvider initialTreeData={[]}>
      <QueryClientProvider client={queryClient}>
        <CunninghamProvider theme="default">{children}</CunninghamProvider>
      </QueryClientProvider>
    </TreeProvider>
  );
};
