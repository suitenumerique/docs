import { PropsWithChildren } from 'react';
import { css } from 'styled-components';

import { Box } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { Footer } from '@/features/footer';
import { Header } from '@/features/header';
import { HEADER_HEIGHT } from '@/features/header/conf';
import { LeftPanel } from '@/features/left-panel';
import { MAIN_LAYOUT_ID } from '@/layouts/conf';
import { useResponsiveStore } from '@/stores';

type MainLayoutProps = {
  backgroundColor?: 'white' | 'grey';
  withoutFooter?: boolean;
};

export function MainLayout({
  children,
  backgroundColor = 'white',
  withoutFooter = false,
}: PropsWithChildren<MainLayoutProps>) {
  const { isDesktop } = useResponsiveStore();
  const { colorsTokens } = useCunninghamTheme();

  const colors = colorsTokens();

  return (
    <div>
      <Header />
      <Box
        $direction="row"
        $margin={{ top: `${HEADER_HEIGHT}px` }}
        $width="100%"
      >
        <LeftPanel />
        <Box
          as="main"
          id={MAIN_LAYOUT_ID}
          $align="center"
          $flex={1}
          $width="100%"
          $height={`calc(100dvh - ${HEADER_HEIGHT}px)`}
          $padding={{
            all: isDesktop ? 'base' : '2xs',
          }}
          $background={
            backgroundColor === 'white'
              ? colors['greyscale-000']
              : colors['greyscale-050']
          }
          $css={css`
            overflow-y: auto;
            overflow-x: clip;
          `}
        >
          {children}
        </Box>
      </Box>
      {!withoutFooter && <Footer />}
    </div>
  );
}
