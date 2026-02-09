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

  if (enableResizablePanel) {
    return (
      <ResizableLeftPanel leftPanel={<LeftPanel />}>
        <MainContent backgroundColor={backgroundColor}>{children}</MainContent>
      </ResizableLeftPanel>
    );
  }

  if (!isDesktop) {
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

const MainContent = ({
  children,
  backgroundColor,
}: PropsWithChildren<MainLayoutContentProps>) => {
  const { isDesktop } = useResponsiveStore();

  const { t } = useTranslation();
  const { colorsTokens } = useCunninghamTheme();
  const currentBackgroundColor = !isDesktop ? 'white' : backgroundColor;

  return (
    <Box
      as="main"
      role="main"
      aria-label={t('Main content')}
      id={MAIN_LAYOUT_ID}
      tabIndex={-1}
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
          ? 'var(--c--contextuals--background--surface--primary)'
          : 'var(--c--contextuals--background--surface--tertiary)'
      }
      $css={css`
        overflow-y: auto;
        overflow-x: clip;
        &:focus-visible::after {
          content: '';
          position: absolute;
          inset: 0;
          border: 3px solid ${colorsTokens['brand-400']};
          pointer-events: none;
          z-index: 2001;
        }
      `}
    >
      <Skeleton>
        <DocEditorSkeleton />
      </Skeleton>
      {children}
    </Box>
  );
};
