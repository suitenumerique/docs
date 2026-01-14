import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, SkipToContent, StyledLink } from '@/components/';
import { useConfig } from '@/core/config';
import { useCunninghamTheme } from '@/cunningham';
import { ButtonLogin } from '@/features/auth';
import { LanguagePicker } from '@/features/language';
import { useResponsiveStore } from '@/stores';

import { HEADER_HEIGHT } from '../conf';

import { ButtonTogglePanel } from './ButtonTogglePanel';
import { Title } from './Title';
import { Waffle } from './Waffle';

export const Header = () => {
  const { t } = useTranslation();
  const { data: config } = useConfig();
  const { spacingsTokens, componentTokens } = useCunninghamTheme();
  const { isDesktop } = useResponsiveStore();

  const icon =
    config?.theme_customization?.header?.icon || componentTokens.icon;

  return (
    <>
      <SkipToContent />
      <Box
        as="header"
        className="--docs--header"
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
          border-bottom: 1px solid
            var(--c--contextuals--border--surface--primary);
        `}
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
              data-testid="header-icon-docs"
              src={icon.src || ''}
              alt=""
              width={0}
              height={0}
              style={{
                width: icon.width,
                height: icon.height,
              }}
              priority
            />
            <Title headingLevel="h1" aria-hidden="true" />
          </Box>
        </StyledLink>
        {!isDesktop ? (
          <Box $direction="row" $gap={spacingsTokens['sm']}>
            <Waffle />
          </Box>
        ) : (
          <Box
            className="--docs--header-block-right"
            $align="center"
            $gap={spacingsTokens['sm']}
            $direction="row"
          >
            <ButtonLogin />
            <LanguagePicker />
            <Waffle />
          </Box>
        )}
      </Box>
    </>
  );
};
