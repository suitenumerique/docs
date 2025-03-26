import Image from 'next/image';
import { useTranslation } from 'react-i18next';

import IconDocs from '@/assets/icons/icon-docs.svg';
import { Box } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { ButtonTogglePanel, Title } from '@/features/header/';
import { LaGaufre } from '@/features/header/components/LaGaufre';
import { LanguagePicker } from '@/features/language';
import { useResponsiveStore } from '@/stores';

export const HEADER_HEIGHT = 91;
export const HEADER_HEIGHT_MOBILE = 52;

export const getHeaderHeight = (isSmallMobile: boolean) =>
  isSmallMobile ? HEADER_HEIGHT_MOBILE : HEADER_HEIGHT;

export const HomeHeader = () => {
  const { t } = useTranslation();
  const { themeTokens, spacingsTokens } = useCunninghamTheme();
  const spacings = spacingsTokens();
  const logo = themeTokens().logo;
  const { isSmallMobile } = useResponsiveStore();

  return (
    <Box
      $direction="row"
      $justify="space-between"
      as="header"
      $align="center"
      $width="100%"
      $padding={{ horizontal: 'small' }}
      $height={`${isSmallMobile ? HEADER_HEIGHT_MOBILE : HEADER_HEIGHT}px`}
      className="--docs--home-header"
    >
      <Box
        $align="center"
        $gap="2rem"
        $direction="row"
        $width={isSmallMobile ? '100%' : 'auto'}
        $justify="center"
      >
        {isSmallMobile && (
          <Box $position="absolute" $css="left: 1rem;">
            <ButtonTogglePanel />
          </Box>
        )}
        {!isSmallMobile && logo && (
          <Image
            priority
            src={logo.src}
            alt={logo.alt}
            width={0}
            height={0}
            style={{ width: logo.widthHeader, height: 'auto' }}
          />
        )}
        <Box
          $align="center"
          $gap={spacings['3xs']}
          $direction="row"
          $position="relative"
          $height="fit-content"
        >
          <IconDocs aria-label={t('Docs Logo')} width={32} />
          <Title />
        </Box>
      </Box>
      {!isSmallMobile && (
        <Box $direction="row" $gap="1rem" $align="center">
          <LanguagePicker />
          <LaGaufre />
        </Box>
      )}
    </Box>
  );
};
