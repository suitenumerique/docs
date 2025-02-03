import Image, { ImageProps } from 'next/image';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { useResponsiveStore } from '@/stores';

export type HomeSectionProps = {
  description: React.ReactNode;
  tag: string;
  title: string;
  availableSoon?: boolean;
  illustration?: ImageProps['src'];
  isColumn?: boolean;
  isSmallDevice?: boolean;
  reverse?: boolean;
  video?: string;
};

export const HomeSection = ({
  availableSoon = false,
  description,
  illustration,
  isSmallDevice,
  isColumn = true,
  reverse = false,
  tag,
  title,
  video,
}: HomeSectionProps) => {
  const { t } = useTranslation();
  const { spacingsTokens } = useCunninghamTheme();
  const spacings = spacingsTokens();

  const { isSmallMobile } = useResponsiveStore();

  const direction = useMemo(() => {
    if (isSmallDevice) {
      return 'column';
    } else if (isColumn) {
      return reverse ? 'column-reverse' : 'column';
    }

    return reverse ? 'row-reverse' : 'row';
  }, [isColumn, isSmallDevice, reverse]);

  return (
    <Box $align="center" $justify="center" $width="100%">
      <Box
        $direction={direction}
        $gap={!isSmallDevice ? spacings['lg'] : spacings['sm']}
        $maxHeight="100%"
        $height="auto"
        $width="100%"
      >
        <Box
          $gap={spacings['sm']}
          $maxWidth="850px"
          $width={direction === 'column' ? '100%' : '52%'}
        >
          <Box $direction="row" $gap={spacings['sm']} $wrap="wrap">
            <SectionTag tag={tag} />
            {availableSoon && (
              <SectionTag tag={t('Available soon')} availableSoon />
            )}
          </Box>
          <Text
            as="h2"
            $css={css`
              line-height: ${!isSmallDevice ? '50px' : 'normal'};
            `}
            $variation="1000"
            $weight="bold"
            $size={!isSmallDevice ? 'xs-alt' : 'h4'}
            $textAlign={isSmallMobile ? 'center' : 'left'}
            $margin="none"
          >
            {title}
          </Text>
          <Text $variation="700" $weight="400" $size="md">
            {description}
          </Text>
        </Box>

        {video && !isSmallDevice && (
          <Box<'video'>
            as="video"
            preload="none"
            loop
            muted
            autoPlay
            src={video}
            $css={css`
              width: 100%;
              max-width: ${isSmallDevice ? 'calc(100dvw - 50px)' : '1200px'};
              height: auto;
              overflow: auto;
              margin: auto;
            `}
            onPlay={(e) => {
              const videoElement = e.currentTarget;
              const observer = new IntersectionObserver(
                (entries) => {
                  entries.forEach((entry) => {
                    if (!entry.isIntersecting) {
                      videoElement.pause();
                    } else {
                      setTimeout(() => {
                        void videoElement.play();
                      }, 500);
                    }
                  });
                },
                { threshold: 0.1 },
              );
              observer.observe(videoElement);
            }}
          >
            <source src={video} type="video/webm" />
          </Box>
        )}

        {illustration && (isSmallDevice || !video) && (
          <Image
            src={illustration}
            alt={t('Illustration')}
            style={{
              width: 'fit-content',
              maxWidth: '100%',
              height: 'fit-content',
              margin: 'auto',
              overflow: 'auto',
            }}
          />
        )}
      </Box>
    </Box>
  );
};

const SectionTag = ({
  tag,
  availableSoon,
}: {
  tag: string;
  availableSoon?: boolean;
}) => {
  const { colorsTokens, spacingsTokens } = useCunninghamTheme();
  const spacings = spacingsTokens();
  const colors = colorsTokens();
  return (
    <Box
      $background={
        !availableSoon ? colors['primary-100'] : colors['warning-100']
      }
      $padding={{ horizontal: spacings['sm'], vertical: '6px' }}
      $css={css`
        align-self: flex-start;
        border-radius: 4px;
      `}
    >
      <Text
        $size="md"
        $variation={availableSoon ? '600' : '800'}
        $weight="bold"
        $theme={availableSoon ? 'warning' : 'primary'}
      >
        {tag}
      </Text>
    </Box>
  );
};
