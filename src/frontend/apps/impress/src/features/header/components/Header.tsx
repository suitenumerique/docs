import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { default as IconDocs } from '@/assets/icons/icon-docs.svg?url';
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
  const theme = useCunninghamTheme();
  const { isDesktop } = useResponsiveStore();

  const spacings = theme.spacingsTokens();
  const colors = theme.colorsTokens();

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
        padding: 0 ${spacings['base']};
        background-color: ${colors['greyscale-000']};
        border-bottom: 1px solid ${colors['greyscale-200']};
      `}
    >
      {!isDesktop && <ButtonTogglePanel />}
      <StyledLink href="/">
        <Box
          $align="center"
          $gap={spacings['3xs']}
          $direction="row"
          $position="relative"
          $height="fit-content"
          $margin={{ top: 'auto' }}
        >
          <Image priority src={IconDocs} alt={t('Docs Logo')} width={25} />
          <Title />
        </Box>
      </StyledLink>
      {!isDesktop ? (
        <Box $direction="row" $gap={spacings['sm']}>
          <LaGaufre />
        </Box>
      ) : (
        <Box $align="center" $gap={spacings['sm']} $direction="row">
          <ButtonLogin />
          <LanguagePicker />
          <LaGaufre />
        </Box>
      )}
    </Box>
  );
};
