import Image from 'next/image';

import { Box } from '@/components';
import { useConfig } from '@/core';
import { useCunninghamTheme } from '@/cunningham';
import { ButtonTogglePanel, Title } from '@/features/header/';
import { Waffle } from '@/features/header/components/Waffle';
import { LanguagePicker } from '@/features/language';
import { useResponsiveStore } from '@/stores';

export const HEADER_HEIGHT = 91;
export const HEADER_HEIGHT_MOBILE = 52;

export const getHeaderHeight = (isSmallMobile: boolean) =>
  isSmallMobile ? HEADER_HEIGHT_MOBILE : HEADER_HEIGHT;

export const HomeHeader = () => {
  const { spacingsTokens, componentTokens } = useCunninghamTheme();
  const logo = componentTokens.logo;
  const { isSmallMobile } = useResponsiveStore();
  const { data: config } = useConfig();

  const icon =
    config?.theme_customization?.header?.icon || componentTokens.icon;

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
        {!isSmallMobile && logo?.src && (
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
          $gap={spacingsTokens['3xs']}
          $direction="row"
          $position="relative"
          $height="fit-content"
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
          <Title />
        </Box>
      </Box>
      {!isSmallMobile && (
        <Box $direction="row" $gap="1rem" $align="center">
          <LanguagePicker />
          <Waffle />
        </Box>
      )}
    </Box>
  );
};
