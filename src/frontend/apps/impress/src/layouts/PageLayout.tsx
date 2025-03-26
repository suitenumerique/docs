import { PropsWithChildren } from 'react';

import { Box } from '@/components';
import { Footer } from '@/features/footer';
import { HEADER_HEIGHT, Header } from '@/features/header';
import { LeftPanel } from '@/features/left-panel';
import { useResponsiveStore } from '@/stores';

interface PageLayoutProps {
  withFooter?: boolean;
}

export function PageLayout({
  children,
  withFooter = true,
}: PropsWithChildren<PageLayoutProps>) {
  const { isDesktop } = useResponsiveStore();

  return (
    <Box
      $minHeight={`calc(100vh - ${HEADER_HEIGHT}px)`}
      $margin={{ top: `${HEADER_HEIGHT}px` }}
      className="--docs--page-layout"
    >
      <Header />
      <Box as="main" $width="100%" $css="flex-grow:1;">
        {!isDesktop && <LeftPanel />}
        {children}
      </Box>
      {withFooter && <Footer />}
    </Box>
  );
}
