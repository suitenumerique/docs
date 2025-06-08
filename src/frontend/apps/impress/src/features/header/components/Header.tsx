import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import IconDocs from '@/assets/icons/icon-docs.svg';
import { Box, StyledLink } from '@/components/';
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
  const { spacingsTokens, colorsTokens } = useCunninghamTheme();
  const { isDesktop } = useResponsiveStore();

  return (
    <Box
      as="header"
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
        background-color: ${colorsTokens['greyscale-000']};
        border-bottom: 1px solid ${colorsTokens['greyscale-200']};
      `}
      className="--docs--header"
    >
      {!isDesktop && <ButtonTogglePanel />}
      <StyledLink href="/">
        <Box
          $align="center"
          $gap={spacingsTokens['3xs']}
          $direction="row"
          $position="relative"
          $height="fit-content"
          $margin={{ top: 'auto' }}
        >
          <IconDocs
            aria-label={t('Docs Logo')}
            width={32}
            color={colorsTokens['primary-text']}
          />
          <Title />
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
