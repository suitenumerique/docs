import { PropsWithChildren } from 'react';
import { css } from 'styled-components';

import { Box } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { Header } from '@/features/header';
import { HEADER_HEIGHT } from '@/features/header/conf';
import { LeftPanel } from '@/features/left-panel';
import { MAIN_LAYOUT_ID } from '@/layouts/conf';
import { useResponsiveStore } from '@/stores';

type MainLayoutProps = {
  backgroundColor?: 'white' | 'grey';
};

export function MainLayout({
  children,
  backgroundColor = 'white',
}: PropsWithChildren<MainLayoutProps>) {
  const { isDesktop } = useResponsiveStore();
  const { colorsTokens } = useCunninghamTheme();
  const colors = colorsTokens();
  const currentBackgroundColor = !isDesktop ? 'white' : backgroundColor;

  return (
    <Box className="--docs--main-layout">
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
            all: isDesktop ? 'base' : '0',
          }}
          $background={
            currentBackgroundColor === 'white'
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
    </Box>
  );
}
