import { PropsWithChildren, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { Header } from '@/features/header';
import { HEADER_HEIGHT } from '@/features/header/conf';
import { LeftPanel } from '@/features/left-panel';
import { MAIN_LAYOUT_ID } from '@/layouts/conf';
import { useResponsiveStore } from '@/stores';

import { ResizableLeftPanel } from './components/ResizableLeftPanel';

type MainLayoutProps = {
  backgroundColor?: 'white' | 'grey';
  enableResizablePanel?: boolean;
};

export function MainLayout({
  children,
  backgroundColor = 'white',
  enableResizablePanel = false,
}: PropsWithChildren<MainLayoutProps>) {
  const { isDesktop } = useResponsiveStore();
  const { colorsTokens } = useCunninghamTheme();
  const currentBackgroundColor = !isDesktop ? 'white' : backgroundColor;
  const { t } = useTranslation();

  const [isResizing, setIsResizing] = useState(false);

  // Main content area (same for all layouts)
  const mainContent = (
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
        all: isDesktop ? 'base' : '0',
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
  );

  // Render layout based on device and resizable panel setting
  const renderContent = () => {
    // Mobile: simple layout
    if (!isDesktop) {
      return (
        <>
          <LeftPanel />
          {mainContent}
        </>
      );
    }

    // Desktop with resizable panel
    if (enableResizablePanel) {
      return (
        <ResizableLeftPanel onResizingChange={setIsResizing}>
          {mainContent}
        </ResizableLeftPanel>
      );
    }

    // Desktop with fixed panel
    return (
      <>
        <Box
          $css={css`
            width: 300px;
            min-width: 300px;
            border-right: 1px solid ${colorsTokens['greyscale-200']};
          `}
        >
          <LeftPanel />
        </Box>
        {mainContent}
      </>
    );
  };

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
        {renderContent()}
      </Box>
    </Box>
  );
}
