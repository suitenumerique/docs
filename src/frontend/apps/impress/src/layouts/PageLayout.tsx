import { PropsWithChildren } from 'react';

import { Box } from '@/components';
import { Footer } from '@/features/footer';
import { HEADER_HEIGHT, Header } from '@/features/header';
import { LeftPanel } from '@/features/left-panel';
import { useResponsiveStore } from '@/stores';

export function PageLayout({ children }: PropsWithChildren) {
  const { isDesktop } = useResponsiveStore();

  return (
    <Box $minHeight="100vh" $margin={{ top: `${HEADER_HEIGHT}px` }}>
      <Header />
      <Box as="main" $width="100%" $css="flex-grow:1;">
        {!isDesktop && <LeftPanel />}
        {children}
      </Box>
      <Footer />
    </Box>
  );
}
