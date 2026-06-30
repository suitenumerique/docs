import { PropsWithChildren } from 'react';

import { Box } from '@/components';
import { Footer } from '@/features/footer';
import { HeaderFloatingBar } from '@/features/header/components/HeaderFloatingBar';
import { LeftPanel } from '@/features/left-panel';

import { MainContent } from './MainLayout';

interface PageLayoutProps {
  withFooter?: boolean;
  withLeftPanel?: boolean;
}

export function PageLayout({
  children,
  withFooter = true,
  withLeftPanel = true,
}: PropsWithChildren<PageLayoutProps>) {
  return (
    <Box className="--docs--page-layout" $direction="row" $minHeight="100vh">
      {withLeftPanel && <LeftPanel />}
      <MainContent>
        <HeaderFloatingBar />
        {children}
      </MainContent>
      {withFooter && <Footer />}
    </Box>
  );
}
