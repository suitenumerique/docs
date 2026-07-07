import { PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, BoxType } from '@/components';
import { LeftPanel, ResizableLeftPanel } from '@/features/left-panel';
import { RightPanel } from '@/features/right-panel/components/RightPanel';
import { DocEditorSkeleton, Skeleton } from '@/features/skeletons';

import { MAIN_LAYOUT_ID } from './conf';
import { usePanelCoordination } from './usePanelCoordination';

type MainLayoutProps = {
  enableResizablePanel?: boolean;
  propsLayout?: BoxType;
  propsContent?: BoxType;
};

export function MainLayout({
  children,
  enableResizablePanel = false,
  propsLayout,
  propsContent,
}: PropsWithChildren<MainLayoutProps>) {
  return (
    <Box
      className="--docs--main-layout"
      $direction="row"
      $width="100%"
      $height="100dvh"
      {...propsLayout}
    >
      <MainLayoutContent
        enableResizablePanel={enableResizablePanel}
        {...propsContent}
      >
        {children}
      </MainLayoutContent>
    </Box>
  );
}

export interface MainLayoutContentProps extends BoxType {
  enableResizablePanel: boolean;
}

export function MainLayoutContent({
  children,
  enableResizablePanel,
  ...props
}: PropsWithChildren<MainLayoutContentProps>) {
  if (enableResizablePanel) {
    return <MainResizableLayout {...props}>{children}</MainResizableLayout>;
  }

  return (
    <>
      <LeftPanel />
      <MainContent {...props}>{children}</MainContent>
      <RightPanel />
    </>
  );
}

const MainResizableLayout = ({
  children,
  ...props
}: PropsWithChildren<BoxType>) => {
  usePanelCoordination();

  return (
    <ResizableLeftPanel>
      <Box $direction="row" $width="100%" $position="relative">
        <MainContent $flex="auto" $padding="0" {...props}>
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
}: PropsWithChildren<BoxType>) => {
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
