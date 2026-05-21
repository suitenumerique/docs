import { PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, BoxProps } from '@/components';
import { Header } from '@/features/header';
import { HEADER_HEIGHT } from '@/features/header/conf';
import { LeftPanel, ResizableLeftPanel } from '@/features/left-panel';
import { RightPanel } from '@/features/right-panel/components/RightPanel';
import { DocEditorSkeleton, Skeleton } from '@/features/skeletons';
import { useResponsiveStore } from '@/stores';

import { MAIN_LAYOUT_ID } from './conf';
import { usePanelCoordination } from './usePanelCoordination';

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
  enableResizablePanel: boolean;
}

export function MainLayoutContent({
  children,
  backgroundColor,
  enableResizablePanel,
}: PropsWithChildren<MainLayoutContentProps>) {
  const { isLargeScreen } = useResponsiveStore();

  if (enableResizablePanel) {
    return (
      <MainResizableLayout backgroundColor={backgroundColor}>
        {children}
      </MainResizableLayout>
    );
  }

  if (!isLargeScreen) {
    return (
      <>
        <LeftPanel />
        <MainContent backgroundColor={backgroundColor}>{children}</MainContent>
      </>
    );
  }

  return (
    <>
      <Box
        $css={css`
          width: 300px;
          border-right: 1px solid
            var(--c--contextuals--border--surface--primary);
        `}
      >
        <LeftPanel />
      </Box>
      <MainContent backgroundColor={backgroundColor}>{children}</MainContent>
    </>
  );
}

interface MainResizableLayoutProps {
  backgroundColor: 'white' | 'grey';
}

const MainResizableLayout = ({
  children,
  backgroundColor,
}: PropsWithChildren<MainResizableLayoutProps>) => {
  usePanelCoordination();

  return (
    <ResizableLeftPanel leftPanel={<LeftPanel />}>
      <Box $direction="row" $width="100%" $position="relative">
        <MainContent
          backgroundColor={backgroundColor}
          $flex="auto"
          $padding="0"
        >
          {children}
        </MainContent>
        <RightPanel />
      </Box>
    </ResizableLeftPanel>
  );
};

type MainContentProps = BoxProps & {
  backgroundColor: 'white' | 'grey';
};

const MainContent = ({
  children,
  backgroundColor,
  ...props
}: PropsWithChildren<MainContentProps>) => {
  const { isDesktop } = useResponsiveStore();

  const { t } = useTranslation();
  const currentBackgroundColor = !isDesktop ? 'white' : backgroundColor;

  return (
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
      $padding={isDesktop ? 'base' : '0'}
      $background={
        currentBackgroundColor === 'white'
          ? 'var(--c--contextuals--background--surface--primary)'
          : 'var(--c--contextuals--background--surface--tertiary)'
      }
      $css={css`
        overflow-y: auto;
        overflow-x: clip;
      `}
      {...props}
    >
      <Skeleton>
        <DocEditorSkeleton />
      </Skeleton>
      {children}
    </Box>
  );
};
