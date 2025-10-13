import { PropsWithChildren, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ImperativePanelHandle,
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from 'react-resizable-panels';
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

export function MainLayout({
  children,
  backgroundColor = 'white',
  enableResize = true,
}: PropsWithChildren<MainLayoutProps>) {
  const { isDesktop } = useResponsiveStore();
  const { colorsTokens } = useCunninghamTheme();
  const currentBackgroundColor = !isDesktop ? 'white' : backgroundColor;
  const { t } = useTranslation();

  // Convert a target pixel width to a percentage of the current viewport width.
  // react-resizable-panels expects sizes in %, not px.
  const calculateDefaultSize = (
    targetWidth: number,
    isDesktopDevice: boolean,
  ) => {
    if (!isDesktopDevice) {
      return 0;
    }
    const windowWidth = window.innerWidth;
    return (targetWidth / windowWidth) * 100;
  };

  const ref = useRef<ImperativePanelHandle>(null);
  const [isResizing, setIsResizing] = useState(false);
  const resizeTimeoutRef = useRef<number | undefined>(undefined);
  const MIN_PANEL_SIZE = 300;
  const MAX_PANEL_SIZE = 450;

  const [minPanelSize, setMinPanelSize] = useState(
    calculateDefaultSize(MIN_PANEL_SIZE, isDesktop),
  );
  const [maxPanelSize, setMaxPanelSize] = useState(
    calculateDefaultSize(MAX_PANEL_SIZE, isDesktop),
  );

  // UX: During window resize, temporarily disable CSS transitions to avoid flicker.
  // This does not affect the resize feature; it only improves visual smoothness.
  useEffect(() => {
    const handleResizeStart = () => {
      setIsResizing(true);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      resizeTimeoutRef.current = window.setTimeout(() => {
        setIsResizing(false);
      }, 150);
    };

    window.addEventListener('resize', handleResizeStart);

    return () => {
      window.removeEventListener('resize', handleResizeStart);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, []);

  // Keep pixel-based constraints while the library works in percentages.
  // We translate px -> % on mount and on viewport resizes so that:
  // - min stays ~300px, max stays ~450px (capped to 40% on small screens)
  // - on mobile, the left panel collapses (min = 0)
  // - when enableResize is false, we lock the size by setting max == min
  useEffect(() => {
    const updatePanelSize = () => {
      const min = Math.round(calculateDefaultSize(MIN_PANEL_SIZE, isDesktop));
      const max = Math.round(
        Math.min(calculateDefaultSize(MAX_PANEL_SIZE, isDesktop), 40),
      );
      setMinPanelSize(isDesktop ? min : 0);
      enableResize ? setMaxPanelSize(max) : setMaxPanelSize(min);
    };

    updatePanelSize();
    window.addEventListener('resize', updatePanelSize);

    return () => {
      window.removeEventListener('resize', updatePanelSize);
    };
  }, [isDesktop, enableResize]);

  return (
    <Box
      className={`--docs--main-layout ${isResizing ? 'resizing' : ''}`}
      $css={css`
        &.resizing * {
          transition: none !important;
        }
      `}
    >
      <Header />
      <Box
        $direction="row"
        $margin={{ top: `${HEADER_HEIGHT}px` }}
        $width="100%"
        $height={`calc(100dvh - ${HEADER_HEIGHT}px)`}
      >
        {isDesktop ? (
          <PanelGroup
            autoSaveId="docs-left-panel-persistence"
            direction="horizontal"
          >
            <Panel
              ref={ref}
              order={0}
              defaultSize={minPanelSize}
              minSize={minPanelSize}
              maxSize={maxPanelSize}
            >
              <LeftPanel />
            </Panel>
            <PanelResizeHandle
              className="border-clr-surface-primary"
              style={{
                borderRightWidth: '1px',
                borderRightStyle: 'solid',
                borderRightColor: colorsTokens['greyscale-200'],
                width: '1px',
                cursor: 'col-resize',
              }}
            />
            <Panel order={1}>
              <Box
                as="main"
                role="main"
                aria-label={t('Main content')}
                id={MAIN_LAYOUT_ID}
                $align="center"
                $width="100%"
                $height={`calc(100dvh - ${HEADER_HEIGHT}px)`}
                $padding={{
                  all: 'base',
                }}
                $background={
                  currentBackgroundColor === 'white'
                    ? colorsTokens['greyscale-000']
                    : colorsTokens['greyscale-050']
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
        ) : (
          <>
            <LeftPanel />
            <Box
              as="main"
              role="main"
              aria-label={t('Main content')}
              id={MAIN_LAYOUT_ID}
              $align="center"
              $flex={1}
              $width="100%"
              $height={`calc(100dvh - ${HEADER_HEIGHT}px)`}
              $padding={{
                all: '0',
              }}
              $background={
                currentBackgroundColor === 'white'
                  ? colorsTokens['greyscale-000']
                  : colorsTokens['greyscale-050']
              }
              $css={css`
                overflow-y: auto;
                overflow-x: clip;
              `}
            >
              {children}
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}
