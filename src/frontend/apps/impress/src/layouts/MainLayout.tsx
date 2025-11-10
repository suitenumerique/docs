import { PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { Header } from '@/features/header';
import { HEADER_HEIGHT } from '@/features/header/conf';
import { LeftPanel, ResizableLeftPanel } from '@/features/left-panel';
import { DocEditorSkeleton, Skeleton } from '@/features/skeletons';
import { useResponsiveStore } from '@/stores';

import { MAIN_LAYOUT_ID } from './conf';

type MainLayoutProps = {
  backgroundColor?: 'white' | 'grey';
  enableResizablePanel?: boolean;
};

export function MainLayout({
  children,
  backgroundColor = 'white',
  enableResizablePanel = false,
}: PropsWithChildren<MainLayoutProps>) {
  return (
    <Box className="--docs--main-layout">
      <Header />
      <Box
        $direction="row"
        $margin={{ top: `${HEADER_HEIGHT}px` }}
        $width="100%"
        $height={`calc(100dvh - ${HEADER_HEIGHT}px)`}
      >
        <MainLayoutContent
          backgroundColor={backgroundColor}
          enableResizablePanel={enableResizablePanel}
        >
          {children}
        </MainLayoutContent>
      </Box>
    </Box>
  );
}

export interface MainLayoutContentProps {
  backgroundColor: 'white' | 'grey';
  enableResizablePanel?: boolean;
}

export function MainLayoutContent({
  children,
  backgroundColor,
  enableResizablePanel = false,
}: PropsWithChildren<MainLayoutContentProps>) {
  const { isDesktop } = useResponsiveStore();
  const { colorsTokens } = useCunninghamTheme();
  const { t } = useTranslation();
  const currentBackgroundColor = !isDesktop ? 'white' : backgroundColor;

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
      $position="relative"
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
      <Skeleton>
        <DocEditorSkeleton />
      </Skeleton>
      {children}
    </Box>
  );

  if (!isDesktop) {
    return (
      <>
        <LeftPanel />
        {mainContent}
      </>
    );
  }

  if (enableResizablePanel) {
    return (
      <ResizableLeftPanel leftPanel={<LeftPanel />}>
        {mainContent}
      </ResizableLeftPanel>
    );
  }

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
}
