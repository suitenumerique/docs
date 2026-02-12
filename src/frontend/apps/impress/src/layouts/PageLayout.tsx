import { PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box } from '@/components';
import { Footer } from '@/features/footer';
import { HEADER_HEIGHT, Header } from '@/features/header';
import { LeftPanel } from '@/features/left-panel';
import { useResponsiveStore } from '@/stores';

import { MAIN_LAYOUT_ID } from './conf';

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
        id={MAIN_LAYOUT_ID}
        tabIndex={-1}
        $width="100%"
        $css={css`
          flex-grow: 1;
          &:focus {
            outline: 3px solid var(--c--globals--colors--primary-600);
            outline-offset: -3px;
          }
          &:focus:not(:focus-visible) {
            outline: none;
          }
        `}
        aria-label={t('Main content')}
      >
        {!isDesktop && <LeftPanel />}
        {children}
      </Box>
      {withFooter && <Footer />}
    </Box>
  );
}
