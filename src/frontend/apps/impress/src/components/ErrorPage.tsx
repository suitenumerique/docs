import { Button } from '@gouvfr-lasuite/cunningham-react';
import Head from 'next/head';
import Image, { StaticImageData } from 'next/image';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { Box, Icon, StyledLink, Text } from '@/components';

const StyledButton = styled(Button)`
  width: fit-content;
`;

interface ErrorPageProps {
  image: StaticImageData;
  description: string;
  refreshTarget?: string;
  showReload?: boolean;
}

const getSafeRefreshUrl = (target?: string): string | undefined => {
  if (!target) {
    return undefined;
  }

  if (typeof window === 'undefined') {
    return target.startsWith('/') && !target.startsWith('//')
      ? target
      : undefined;
  }

  try {
    const url = new URL(target, window.location.origin);
    if (url.origin !== window.location.origin) {
      return undefined;
    }
    return url.pathname + url.search + url.hash;
  } catch {
    return undefined;
  }
};

export const ErrorPage = ({
  image,
  description,
  refreshTarget,
  showReload,
}: ErrorPageProps) => {
  const { t } = useTranslation();

  const errorTitle = t('An unexpected error occurred.');
  const safeTarget = getSafeRefreshUrl(refreshTarget);

  return (
    <>
      <Head>
        <title>
          {errorTitle} - {t('Docs')}
        </title>
        <meta
          property="og:title"
          content={`${errorTitle} - ${t('Docs')}`}
          key="title"
        />
      </Head>
      <Box
        $align="center"
        $margin="auto"
        $gap="md"
        $padding={{ bottom: '2rem' }}
      >
        <Text as="h1" $textAlign="center" className="sr-only">
          {errorTitle} - {t('Docs')}
        </Text>
        <Image
          src={image}
          alt=""
          width={300}
          style={{
            maxWidth: '100%',
            height: 'auto',
          }}
          loading="eager"
        />

        <Text
          as="p"
          $textAlign="center"
          $maxWidth="350px"
          $theme="neutral"
          $margin="0"
        >
          {description}
        </Text>

        <Box $direction="row" $gap="sm">
          <StyledLink href="/">
            <StyledButton
              color="neutral"
              icon={
                <Icon
                  iconName="house"
                  variant="symbols-outlined"
                  $withThemeInherited
                />
              }
            >
              {t('Home')}
            </StyledButton>
          </StyledLink>

          {(safeTarget || showReload) && (
            <StyledButton
              color="neutral"
              variant="bordered"
              icon={
                <Icon
                  iconName="refresh"
                  variant="symbols-outlined"
                  $withThemeInherited
                />
              }
              onClick={() =>
                safeTarget
                  ? window.location.assign(safeTarget)
                  : window.location.reload()
              }
            >
              {t('Refresh page')}
            </StyledButton>
          )}
        </Box>
      </Box>
    </>
  );
};
