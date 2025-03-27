import { Button } from '@openfun/cunningham-react';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import DocLogo from '@/assets/icons/icon-docs.svg?url';
import { Box, Icon, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { ProConnectButton, gotoLogin } from '@/features/auth';
import { useResponsiveStore } from '@/stores';

import banner from '../assets/banner.jpg';

import { getHeaderHeight } from './HomeHeader';

export default function HomeBanner() {
  const { t } = useTranslation();
  const { componentTokens, spacingsTokens } = useCunninghamTheme();
  const spacings = spacingsTokens();
  const { isMobile, isSmallMobile } = useResponsiveStore();
  const withProConnect = componentTokens()['home-proconnect'].activated;

  return (
    <Box
      $maxWidth="78rem"
      $width="100%"
      $justify="space-around"
      $align="center"
      $height="100vh"
      $margin={{ top: `-${getHeaderHeight(isSmallMobile)}px` }}
      $position="relative"
      className="--docs--home-banner"
    >
      <Box
        $width="100%"
        $justify="center"
        $align="center"
        $position="relative"
        $direction={!isMobile ? 'row' : 'column'}
        $gap="1rem"
        $overflow="auto"
        $css="flex-basis: 70%;"
      >
        <Box
          $width={!isMobile ? '50%' : '100%'}
          $justify="center"
          $align="center"
          $gap={spacings['sm']}
        >
          <Image src={DocLogo} alt="DocLogo" width={64} />
          <Text
            as="h2"
            $size={!isMobile ? 'xs-alt' : '2.3rem'}
            $variation="800"
            $weight="bold"
            $textAlign="center"
            $margin="none"
            $css={css`
              line-height: ${!isMobile ? '56px' : '45px'};
            `}
          >
            {t('Collaborative writing, Simplified.')}
          </Text>
          <Text
            $size="lg"
            $variation="700"
            $textAlign="center"
            $margin={{ bottom: 'small' }}
          >
            {t(
              'Collaborate and write in real time, without layout constraints.',
            )}
          </Text>
          {withProConnect ? (
            <ProConnectButton />
          ) : (
            <Button
              onClick={() => gotoLogin()}
              icon={<Icon iconName="bolt" $color="white" />}
            >
              {t('Start Writing')}
            </Button>
          )}
        </Box>
        {!isMobile && (
          <Image
            src={banner}
            alt={t('Banner image')}
            priority
            style={{
              width: 'auto',
              maxWidth: '100%',
              height: 'fit-content',
              overflow: 'auto',
              maxHeight: '100%',
            }}
          />
        )}
      </Box>
      <Box $css="bottom: 3rem" $position="absolute">
        <Button
          color="secondary"
          icon={
            <Icon $theme="primary" $variation="800" iconName="expand_more" />
          }
          onClick={(e) => {
            e.preventDefault();
            document
              .querySelector('#docs-app-info')
              ?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          {t('Show more')}
        </Button>
      </Box>
    </Box>
  );
}
