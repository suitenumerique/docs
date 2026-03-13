import { useTranslation } from 'react-i18next';
import { createGlobalStyle, css } from 'styled-components';

import { Box, HorizontalSeparator, SeparatedSection } from '@/components';
import { useConfig } from '@/core/config/api/useConfig';
import { useCunninghamTheme } from '@/cunningham';
import { ButtonLogin } from '@/features/auth';
import { HEADER_HEIGHT } from '@/features/header/conf';
import { HelpMenu } from '@/features/help';
import { LanguagePicker } from '@/features/language';
import { useResponsiveStore } from '@/stores';

import { useLeftPanelStore } from '../stores';

import { LeftPanelContent } from './LeftPanelContent';
import { LeftPanelHeader } from './LeftPanelHeader';

const MobileLeftPanelStyle = createGlobalStyle`
  body {
    overflow: hidden;
  }
`;

export const LeftPanel = () => {
  const { isDesktop } = useResponsiveStore();
  const { t } = useTranslation();

  const { spacingsTokens } = useCunninghamTheme();
  const { isPanelOpen, isPanelOpenMobile } = useLeftPanelStore();
  const isPanelOpenState = isDesktop ? isPanelOpen : isPanelOpenMobile;
  const { data: config } = useConfig();
  /**
   * The onboarding can be disable, so we need to check if it's enabled before displaying the help menu.
   * TODO: As soon as we get more than one fixed element in the help menu,
   * we should remove this condition and display the help menu even if the onboarding is disabled
   */
  const showHelpMenu = config?.theme_customization?.onboarding?.enabled;

  if (isDesktop) {
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
        {showHelpMenu && (
          <SeparatedSection showSeparator={false}>
            <Box $padding={{ horizontal: 'sm' }} $justify="flex-start">
              <HelpMenu />
            </Box>
          </SeparatedSection>
        )}
      </Box>
    );
  }

  return (
    <>
      {isPanelOpenState && <MobileLeftPanelStyle />}
      <Box
        $hasTransition
        $height="100vh"
        $css={css`
          z-index: 999;
          width: 100dvw;
          height: calc(100dvh - 52px);
          border-right: 1px solid var(--c--globals--colors--gray-200);
          position: fixed;
          transform: translateX(${isPanelOpenState ? '0' : '-100dvw'});
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
          <Box $width="100%">
            <HorizontalSeparator $margin="none" />
            <SeparatedSection showSeparator={false}>
              <Box
                $justify="end"
                $align="center"
                $gap={spacingsTokens['xs']}
                $direction="row"
                $padding={{ horizontal: 'sm' }}
              >
                <HelpMenu colorButton="brand" />
                <ButtonLogin />
                <LanguagePicker />
              </Box>
            </SeparatedSection>
          </Box>
        </Box>
      </Box>
    </>
  );
};
