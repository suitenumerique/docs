import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { createGlobalStyle, css } from 'styled-components';

import { Box, SeparatedSection } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { ButtonLogin } from '@/features/auth';
import { HEADER_HEIGHT } from '@/features/header/conf';
import { LanguagePicker } from '@/features/language';
import { useResponsiveStore } from '@/stores';

import { useLeftPanelStore } from '../stores';

import { LeftPanelContent } from './LeftPanelContent';
import { LeftPanelHeader } from './LeftPanelHeader';
import { LeftPanelHelpMenu } from './LeftPanelHelpMenu';

const MobileLeftPanelStyle = createGlobalStyle`
  body {
    overflow: hidden;
  }
`;

export const LeftPanel = () => {
  const { isDesktop } = useResponsiveStore();
  const { t } = useTranslation();

  const { spacingsTokens } = useCunninghamTheme();
  const { togglePanel, isPanelOpen } = useLeftPanelStore();

  const pathname = usePathname();

  useEffect(() => {
    togglePanel(false);
  }, [pathname, togglePanel]);

  return (
    <>
      {isDesktop && (
        <Box
          data-testid="left-panel-desktop"
          $css={css`
            height: calc(100vh - ${HEADER_HEIGHT}px);
            width: 100%;
            overflow: hidden;
            background-color: var(--c--globals--colors--gray-000);
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
          <SeparatedSection showSeparator={false}>
            <Box
              $padding={{ horizontal: 'sm', vertical: 'xs' }}
              $justify="flex-start"
            >
              <LeftPanelHelpMenu />
            </Box>
          </SeparatedSection>
        </Box>
      )}

      {!isDesktop && (
        <>
          {isPanelOpen && <MobileLeftPanelStyle />}
          <Box
            $hasTransition
            $css={css`
              z-index: 999;
              width: 100dvw;
              height: calc(100dvh - 52px);
              border-right: 1px solid var(--c--globals--colors--gray-200);
              position: fixed;
              transform: translateX(${isPanelOpen ? '0' : '-100dvw'});
              background-color: var(--c--globals--colors--gray-000);
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
            >
              <LeftPanelHeader />
              <LeftPanelContent />
              <SeparatedSection showSeparator={false}>
                <Box
                  $padding={{ horizontal: 'sm', vertical: 'xs' }}
                  $justify="flex-start"
                >
                  <LeftPanelHelpMenu />
                </Box>
              </SeparatedSection>
              <SeparatedSection showSeparator={false}>
                <Box
                  $justify="center"
                  $align="center"
                  $gap={spacingsTokens['sm']}
                >
                  <ButtonLogin />
                  <LanguagePicker />
                </Box>
              </SeparatedSection>
            </Box>
          </Box>
        </>
      )}
    </>
  );
};
