import { Button } from '@gouvfr-lasuite/cunningham-react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import {
  Box,
  ButtonCloseModal,
  SeparatedSection,
  StyledLink,
} from '@/components';
import { Title } from '@/components/Title';
import { useConfig } from '@/core';
import { NewDocButton } from '@/docs/doc-management/components/NewDocButton';
import { DocSearchButtonModal } from '@/docs/doc-search/components/DocSearchButtonModal';
import { useAuth } from '@/features/auth';
import HomeSVG from '@/icons/house-rounded.svg';
import { useResponsiveStore } from '@/stores';

import { useLeftPanelStore } from '../stores';

export const LeftPanelHeader = () => {
  const { data: config } = useConfig();
  const { isMobile } = useResponsiveStore();
  const { closePanel } = useLeftPanelStore();
  const icon = config?.theme_customization?.header?.icon;

  return (
    <Box $width="100%" className="--docs--left-panel-header">
      <Box
        $padding={{ horizontal: 'sm' }}
        $direction="row"
        $align="center"
        $gap="2xs"
        $minHeight="68px"
      >
        <StyledLink
          href="/"
          data-testid="header-logo-link"
          $css={css`
            outline: none;
            &:focus-visible {
              box-shadow: 0 0 0 2px var(--c--globals--colors--brand-400) !important;
              border-radius: var(--c--globals--spacings--st);
            }
          `}
        >
          <Box
            $align="center"
            $gap="var(--c--globals--spacings--4xs)"
            $direction="row"
            $position="relative"
            $height="fit-content"
            $margin={{ top: 'auto' }}
          >
            {icon && (
              <Image
                data-testid="header-icon-docs"
                width={0}
                height={0}
                priority
                {...(({ withTitle: _, ...rest }) => rest)(icon)}
              />
            )}
            <Title
              headingLevel="h1"
              className={icon?.withTitle ? undefined : 'sr-only'}
              $size="1.8rem"
            />
          </Box>
        </StyledLink>
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
    void router.push('/');

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
            <Button
              data-testid="home-button"
              onClick={goToHome}
              aria-label={t('Back to homepage')}
              size="medium"
              color="brand"
              variant="tertiary"
              icon={<HomeSVG aria-hidden="true" width={24} height={24} />}
            />
          )}
          <DocSearchButtonModal />
        </Box>
      </Box>
    </SeparatedSection>
  );
};
