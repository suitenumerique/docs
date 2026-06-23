import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { createGlobalStyle, css } from 'styled-components';

import { Box } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { HEADER_HEIGHT } from '@/features/header/conf';
import { useResponsiveStore } from '@/stores';

import { useLeftPanelStore } from '../stores';

import { LeftPanelContent } from './LeftPanelContent';
import { LeftPanelFooter } from './LeftPanelFooter';
import { LeftPanelHeader } from './LeftPanelHeader';

const MobileLeftPanelStyle = createGlobalStyle`
  body {
    overflow: hidden;
  }
`;

export const LeftPanel = () => {
  const { isLargeScreen } = useResponsiveStore();
  if (isLargeScreen) {
    return <LeftPanelDesktop />;
  }

  return <LeftPanelMobile />;
};

export const LeftPanelDesktop = () => {
  const { t } = useTranslation();

  return (
    <Box
      data-testid="left-panel-desktop"
      $css={css`
        height: calc(100vh - ${HEADER_HEIGHT}px);
        width: 100%;
        overflow: hidden;
        background-color: var(--c--contextuals--background--surface--primary);
      `}
      className="--docs--left-panel-desktop"
      as="nav"
      aria-label={t('Document sections')}
    >
      <Box
        $css={css`
          flex: 0 0 auto;
        `}
      >
        <LeftPanelHeader />
      </Box>
      <LeftPanelContent />
      <LeftPanelFooter />
    </Box>
  );
};

const LeftPanelMobile = () => {
  const { t } = useTranslation();
  const { spacingsTokens } = useCunninghamTheme();
  const { closePanel, isPanelOpenMobile } = useLeftPanelStore();
  const pathname = usePathname();

  useEffect(() => {
    closePanel({ type: 'mobile' });
  }, [pathname, closePanel]);

  return (
    <>
      {isPanelOpenMobile && <MobileLeftPanelStyle />}
      <Box
        $hasTransition
        $height="100vh"
        inert={!isPanelOpenMobile}
        $css={css`
          z-index: 999;
          width: 100dvw;
          height: calc(100dvh - 52px);
          border-right: 1px solid var(--c--globals--colors--gray-200);
          position: fixed;
          transform: translateX(${isPanelOpenMobile ? '0' : '-100dvw'});
          background-color: var(--c--contextuals--background--surface--primary);
          overflow-y: auto;
          overflow-x: hidden;
        `}
        className="--docs--left-panel-mobile"
      >
        <Box
          data-testid="left-panel-mobile"
          as="nav"
          aria-label={t('Document sections')}
          $css={css`
            width: 100%;
            justify-content: center;
            align-items: center;
            gap: ${spacingsTokens['base']};
          `}
          $height="inherit"
        >
          <LeftPanelHeader />
          <LeftPanelContent />
          <LeftPanelFooter />
        </Box>
      </Box>
    </>
  );
};
