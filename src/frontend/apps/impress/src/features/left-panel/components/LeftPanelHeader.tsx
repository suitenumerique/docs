import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';

import {
  Box,
  ButtonCloseModal,
  SeparatedSection,
  StyledLink,
} from '@/components';
import { NewDocButton } from '@/docs/doc-management/components/NewDocButton';
import { DocSearchButtonModal } from '@/docs/doc-search/components/DocSearchButtonModal';
import { useAuth } from '@/features/auth';
import { HEADER_ROW_MIN_HEIGHT, HeaderLogoLink } from '@/features/header';
import HomeSVG from '@/icons/house-rounded.svg';
import { useResponsiveStore } from '@/stores';

import { useLeftPanelStore } from '../stores';

export const LeftPanelHeader = () => {
  const { isMobile } = useResponsiveStore();
  const { closePanel } = useLeftPanelStore();

  return (
    <Box $width="100%" className="--docs--left-panel-header">
      <Box
        $padding={{ horizontal: 'xs' }}
        $direction="row"
        $align="center"
        $gap="2xs"
        $minHeight={HEADER_ROW_MIN_HEIGHT}
      >
        <HeaderLogoLink headingLevel="h1" />
        {isMobile && (
          <Box $margin={{ left: 'auto' }}>
            <ButtonCloseModal
              onClick={closePanel}
              aria-label="Close left panel"
            />
          </Box>
        )}
      </Box>
      <LeftPanelHeaderActions />
    </Box>
  );
};
export const LeftPanelHeaderActions = () => {
  const router = useRouter();
  const { authenticated } = useAuth();
  const { togglePanel, closePanel } = useLeftPanelStore();
  const { t } = useTranslation();
  const { isMobile } = useResponsiveStore();

  const goToHome = () => {
    if (isMobile) {
      togglePanel();
    }
  };

  return (
    <SeparatedSection>
      <Box
        $padding={{ horizontal: 'sm' }}
        $width="100%"
        $direction="row"
        $justify="space-between"
        $align="center"
      >
        {authenticated && (
          <NewDocButton onClose={() => isMobile && closePanel()} />
        )}
        <Box $direction="row" $gap="2px" $margin={{ left: 'auto' }}>
          {router.pathname !== '/' && (
            <StyledLink
              href="/"
              data-testid="home-button"
              onClick={goToHome}
              aria-label={t('Back to homepage')}
              title={t('Back to homepage')}
              $css={`
                align-items: center;
                justify-content: center;
                width: 40px;
                height: 40px;
                color: var(--c--contextuals--content--semantic--brand--tertiary);
                border-radius: var(--c--globals--spacings--3xs);
                &:hover {
                  background-color: var(--c--contextuals--background--semantic--brand--tertiary);
                }
                &:focus-visible {
                  outline: 2px solid var(--c--contextuals--content--semantic--brand--tertiary);
                  outline-offset: var(--c--globals--spacings--st);
                }
              `}
            >
              <HomeSVG aria-hidden="true" width={24} height={24} />
            </StyledLink>
          )}
          <DocSearchButtonModal />
        </Box>
      </Box>
    </SeparatedSection>
  );
};
