import { Button } from '@openfun/cunningham-react';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon, Text } from '@/components';
import { ProConnectButton } from '@/components/ProConnectButton';
import { useCunninghamTheme } from '@/cunningham';
import { useResponsiveStore } from '@/stores';

import firstImage from '../assets/banner.png';
import DocLogo from '../assets/logo-docs.png';

export default function HomeBanner() {
  const { t } = useTranslation();
  const { spacingsTokens } = useCunninghamTheme();
  const spacings = spacingsTokens();
  const { isDesktop } = useResponsiveStore();

  return (
    <Box $maxWidth="78rem" $width="100%" $justify="center" $align="center">
      <Box
        $width="100%"
        $padding={{ top: 'xxxl', bottom: 'calc(3.5rem + 94px)' }}
        $justify="space-between"
        $align="center"
        $height="calc(100dvh - 94px)"
        $position="relative"
        $direction={isDesktop ? 'row' : 'column'}
      >
        <Box
          $width="100%"
          $justify="center"
          $align="center"
          $padding={{ horizontal: '10px' }}
          $gap={spacings['sm']}
        >
          <Image src={DocLogo} alt="DocLogo" />
          <Text
            $size={isDesktop ? 'xs-alt' : '2.3rem'}
            $variation="800"
            $weight="bold"
            $textAlign="center"
            $css={css`
              line-height: 56px;
            `}
          >
            {t('Collaborative writing made simple')}
          </Text>
          <Text $size="lg" $variation="700" $textAlign="center">
            {t(
              'Collaborate and write in real time, without layout constraints.',
            )}
          </Text>
          <ProConnectButton />
        </Box>
        {isDesktop && (
          <Image src={firstImage} alt="first" style={{ maxWidth: '50%' }} />
        )}
        <Box
          $position="absolute"
          $padding="base"
          $justify="center"
          $align="center"
          $css={css`
            bottom: 0;
            left: 0;
            right: 0;
          `}
        >
          <Button
            href="#docs-app-info"
            color="secondary"
            icon={
              <Icon $theme="primary" $variation="800" iconName="expand_more" />
            }
          >
            {t('See more')}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
