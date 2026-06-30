import { PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, BoxProps } from '@/components';
import { LeftPanel, ResizableLeftPanel } from '@/features/left-panel';
import { RightPanel } from '@/features/right-panel/components/RightPanel';
import { DocEditorSkeleton, Skeleton } from '@/features/skeletons';

import { MAIN_LAYOUT_ID } from './conf';
import { usePanelCoordination } from './usePanelCoordination';

type MainLayoutProps = {
  enableResizablePanel?: boolean;
};

export function MainLayout({
  children,
  enableResizablePanel = false,
}: PropsWithChildren<MainLayoutProps>) {
  return (
    <Box
      className="--docs--main-layout"
      $direction="row"
      $width="100%"
      $height="100dvh"
    >
      <MainLayoutContent enableResizablePanel={enableResizablePanel}>
        {children}
      </MainLayoutContent>
    </Box>
  );
}

export interface MainLayoutContentProps {
  enableResizablePanel: boolean;
}

export function MainLayoutContent({
  children,
  enableResizablePanel,
}: PropsWithChildren<MainLayoutContentProps>) {
  if (enableResizablePanel) {
    return <MainResizableLayout>{children}</MainResizableLayout>;
  }

  return (
    <>
      <LeftPanel />
      <MainContent>{children}</MainContent>
      <RightPanel />
    </>
  );
}

const MainResizableLayout = ({ children }: PropsWithChildren) => {
  usePanelCoordination();

  return (
    <ResizableLeftPanel>
      <Box $direction="row" $width="100%" $position="relative">
        <MainContent $flex="auto" $padding="0">
          {children}
        </MainContent>
        <RightPanel />
      </Box>
    </ResizableLeftPanel>
  );
};

export const MainContent = ({
  children,
  ...props
}: PropsWithChildren<BoxProps>) => {
  const { t } = useTranslation();

  return (
    <Box
      as="main"
      role="main"
      aria-label={t('Main content')}
      id={MAIN_LAYOUT_ID}
      $align="center"
      $flex={1}
      $width="100%"
      $height="100dvh"
      $position="relative"
      $background="var(--c--contextuals--background--surface--primary)"
      $css={css`
        overflow-y: auto;
        overflow-x: clip;

        &:focus-visible {
          outline: none;
        }
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
