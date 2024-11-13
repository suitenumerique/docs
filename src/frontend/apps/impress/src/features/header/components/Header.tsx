import Image from 'next/image';
import { useTranslation } from 'react-i18next';

import { Box, StyledLink } from '@/components/';
import { ButtonLogin } from '@/core/auth';
import { LanguagePicker } from '@/features/language';
import { useResponsiveStore } from '@/stores';

import { default as IconDocs } from '../assets/icon-docs.svg?url';

import { DropdownMenu } from './DropdownMenu';
import { LaGaufre } from './LaGaufre';
import Title from './Title/Title';

export const Header = () => {
  const { t } = useTranslation();
  const { isSmallMobile } = useResponsiveStore();

  return (
    <Box
      as="header"
      $justify="center"
      $width="100%"
      $zIndex="100"
      $padding={{ vertical: 'xtiny' }}
      $css="border-bottom: 1px solid #EDEDED;"
    >
      <Box
        $margin={{
          left: 'big',
          right: isSmallMobile ? 'none' : 'big',
        }}
        $align="center"
        $justify="space-between"
        $direction="row"
      >
        <Box>
          <StyledLink href="/">
            <Box
              $align="center"
              $gap="0.8rem"
              $direction="row"
              $position="relative"
              $height="fit-content"
              $margin={{ top: 'auto' }}
            >
              <Image priority src={IconDocs} alt={t('Docs Logo')} width={25} />
              <Title />
            </Box>
          </StyledLink>
        </Box>
        {isSmallMobile ? (
          <Box $direction="row" $gap="2rem">
            <LaGaufre />
            <DropdownMenu />
          </Box>
        ) : (
          <Box $align="center" $gap="2vw" $direction="row">
            <ButtonLogin />
            <LanguagePicker />
            <LaGaufre />
          </Box>
        )}
      </Box>
    </Box>
  );
};
