import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, StyledLink } from '@/components/';
import { useConfig } from '@/core/config';
import { useCunninghamTheme } from '@/cunningham';
import { ButtonLogin } from '@/features/auth';
import { LanguagePicker } from '@/features/language';
import { useResponsiveStore } from '@/stores';

import { HEADER_HEIGHT } from '../conf';

import { ButtonTogglePanel } from './ButtonTogglePanel';
import { LaGaufre } from './LaGaufre';
import { Title } from './Title';

export const Header = () => {
  const { t } = useTranslation();
  const { data: config } = useConfig();
  const { spacingsTokens } = useCunninghamTheme();
  const { isDesktop } = useResponsiveStore();

  const logo = config?.theme_customization?.header?.logo;

  return (
    <Box
      as="header"
      role="banner"
      $css={css`
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 1000;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        height: ${HEADER_HEIGHT}px;
        padding: 0 ${spacingsTokens['base']};
        background-color: var(--c--contextuals--background--surface--primary);
        border-bottom: 1px solid var(--c--contextuals--border--surface--primary);
      `}
      className="--docs--header"
    >
      {!isDesktop && <ButtonTogglePanel />}
      <StyledLink
        href="/"
        data-testid="header-logo-link"
        aria-label={t('Back to homepage')}
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
          $gap={spacingsTokens['3xs']}
          $direction="row"
          $position="relative"
          $height="fit-content"
          $margin={{ top: 'auto' }}
        >
          <Image
            className="c__image-system-filter"
            data-testid="header-icon-docs"
            src={logo?.src || '/assets/icon-docs.svg'}
            alt=""
            width={0}
            height={0}
            style={{
              width: logo?.width || 32,
              height: logo?.height || 'auto',
            }}
            priority
          />
          <Title headingLevel="h1" aria-hidden="true" />
        </Box>
      </StyledLink>
      {!isDesktop ? (
        <Box $direction="row" $gap={spacingsTokens['sm']}>
          <LaGaufre />
        </Box>
      ) : (
        <Box $align="center" $gap={spacingsTokens['sm']} $direction="row">
          <ButtonLogin />
          <LanguagePicker />
          <LaGaufre />
        </Box>
      )}
    </Box>
  );
};
