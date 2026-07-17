import { PropsWithChildren, ReactNode } from 'react';

import { Box } from '@/components';
import { Footer } from '@/features/footer';
import { HeaderFloatingBar } from '@/features/header/components/HeaderFloatingBar';
import { LeftPanel } from '@/features/left-panel';

import { MainContent } from './MainLayout';

interface PageLayoutProps {
  withFooter?: boolean;
  withLeftPanel?: boolean;
  headerSlot?: ReactNode;
  footerSlot?: ReactNode;
}

export function PageLayout({
  children,
  withFooter = true,
  withLeftPanel = true,
  headerSlot,
  footerSlot,
}: PropsWithChildren<PageLayoutProps>) {
  return (
    <Box className="--docs--page-layout" $direction="row" $minHeight="100vh">
      {withLeftPanel && <LeftPanel />}
      <MainContent>
        {headerSlot !== undefined ? headerSlot : <HeaderFloatingBar />}
        {children}
        {footerSlot}
      </MainContent>
      {withFooter && <Footer />}
    </Box>
  );
}
