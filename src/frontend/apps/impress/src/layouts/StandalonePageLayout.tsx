import { PropsWithChildren } from 'react';

import { Box } from '@/components';
import { FooterBar } from '@/features/footer';
import { HeaderBar } from '@/features/header';

import { MainContent } from './MainLayout';

/**
 * Layout for pages reached outside of the application shell (email links,
 * error pages): no left panel, a slim header and footer around the content.
 */
export function StandalonePageLayout({ children }: PropsWithChildren) {
  return (
    <Box className="--docs--standalone-page-layout" $minHeight="100dvh">
      <HeaderBar />
      <MainContent $height="auto" $flex={1} $justify="center">
        {children}
      </MainContent>
      <FooterBar />
    </Box>
  );
}
