import { PropsWithChildren, useEffect, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
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
  enableResize?: boolean;
};

const calculateDefaultSize = (targetWidth: number, isDesktop: boolean) => {
  if (!isDesktop) {
    return 0;
  }
  const windowWidth = window.innerWidth;
  console.log('windowWidth', windowWidth);
  return (targetWidth / windowWidth) * 100;
  // On limite le pourcentage entre 20 et 40 pour éviter des panneaux trop petits ou trop grands
};

export function MainLayout({
  children,
  backgroundColor = 'white',
  enableResize = false,
}: PropsWithChildren<MainLayoutProps>) {
  const windowWidth = window.innerWidth;
  const { isDesktop } = useResponsiveStore();
  const { colorsTokens } = useCunninghamTheme();

  const [minPanelSize, setMinPanelSize] = useState(
    calculateDefaultSize(300, isDesktop),
  );
  const [maxPanelSize, setMaxPanelSize] = useState(
    calculateDefaultSize(450, isDesktop),
  );

  useEffect(() => {
    const updatePanelSize = () => {
      const min = calculateDefaultSize(300, isDesktop);
      const max = Math.min(calculateDefaultSize(450, isDesktop), 40);
      setMinPanelSize(isDesktop ? min : 0);
      if (enableResize) {
        setMaxPanelSize(max);
      } else {
        setMaxPanelSize(min);
      }
    };

    updatePanelSize();
    window.addEventListener('resize', () => {
      console.log('resize');
      updatePanelSize();
    });

    return () => {
      window.removeEventListener('resize', updatePanelSize);
    };
  }, [isDesktop, enableResize]);

  const colors = colorsTokens();

  return (
    <div>
      <Header />
      <Box
        $direction="row"
        $margin={{ top: `${HEADER_HEIGHT}px` }}
        $width="100%"
      >
        <PanelGroup direction="horizontal">
          <Panel
            defaultSize={minPanelSize}
            minSize={minPanelSize}
            maxSize={maxPanelSize}
          >
            <LeftPanel />
          </Panel>
          <PanelResizeHandle />
          <Panel>
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
          </Panel>
        </PanelGroup>
      </Box>
    </div>
  );
}
