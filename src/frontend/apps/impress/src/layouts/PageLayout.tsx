import { PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  return (
    <Box
      $minHeight={`calc(100vh - ${HEADER_HEIGHT}px)`}
      $margin={{ top: `${HEADER_HEIGHT}px` }}
      className="--docs--page-layout"
    >
      <Header />
      <Box
        as="main"
        role="main"
        $width="100%"
        $css="flex-grow:1;"
        aria-label={t('Main content')}
      >
        {!isDesktop && <LeftPanel />}
        {children}
      </Box>
      {withFooter && <Footer />}
    </Box>
  );
}
