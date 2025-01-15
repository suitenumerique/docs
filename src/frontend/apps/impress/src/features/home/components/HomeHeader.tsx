import Image from 'next/image';

import IconDocs from '@/assets/common/logo-docs-sm.png';
import { Box } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { LaGaufre } from '@/features/header/components/LaGaufre';
import Title from '@/features/header/components/Title/Title';
import { LanguagePicker } from '@/features/language';
import { useResponsiveStore } from '@/stores';

export const HomeHeader = () => {
  const { isDesktop } = useResponsiveStore();
  const { themeTokens, spacingsTokens } = useCunninghamTheme();
  const logo = themeTokens().logo;
  const spacings = spacingsTokens();
  return (
    <Box
      $direction="row"
      $justify="space-between"
      as="header"
      $align="center"
      $width="100%"
      $padding={{ horizontal: '18px', vertical: 'base' }}
    >
      <Box $align="center" $gap="3rem" $direction="row">
        {logo && (
          <Image
            priority
            src={logo.src}
            alt={logo.alt}
            width={0}
            height={0}
            style={{ width: 109, height: 'auto' }}
          />
        )}

        {isDesktop && (
          <Box
            $align="center"
            $gap={spacings['3xs']}
            $direction="row"
            $position="relative"
            $height="fit-content"
          >
            <Image src={IconDocs} alt="Docs app logo" />
            <Title />
          </Box>
        )}
      </Box>
      <Box $direction="row" $gap="1rem" $align="center">
        <LanguagePicker />
        <LaGaufre />
      </Box>
    </Box>
  );
};
