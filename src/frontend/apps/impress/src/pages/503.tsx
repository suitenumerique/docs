import Head from 'next/head';
import { useRouter } from 'next/router';
import { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import Error503Svg from '@/assets/icons/error-503.svg';
import { Box, BoxButton, Icon, Text } from '@/components';
import { StandalonePageLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';

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

const Page: NextPageWithLayout = () => {
  const { t } = useTranslation();
  const { query } = useRouter();
  const from = Array.isArray(query.from) ? query.from[0] : query.from;
  const refreshTarget =
    from?.startsWith('/') && !from.startsWith('//') ? from : undefined;
  const safeTarget = getSafeRefreshUrl(refreshTarget);
  const pageTitle = `${t('Error 503')} - ${t('Docs')}`;

  return (
    <>
      <Head>
        <meta name="robots" content="noindex" />
        <title>{pageTitle}</title>
        <meta property="og:title" content={pageTitle} key="title" />
      </Head>
      <Box
        $align="center"
        $gap="base"
        $padding={{ horizontal: 'base', bottom: 'lg' }}
        className="--docs--error-503"
      >
        <Box $align="center" $gap="xxxs">
          <Error503Svg aria-hidden="true" />
          <Text
            as="h1"
            $size="md"
            $weight="bold"
            $textAlign="center"
            $margin="0"
            $theme="neutral"
            $variation="primary"
          >
            {t('Error 503')}
          </Text>
          <Text
            as="p"
            $textAlign="center"
            $maxWidth="228px"
            $theme="neutral"
            $variation="secondary"
            $margin="0"
            $size="xs"
          >
            {t('The server is temporarily overloaded or unavailable')}
          </Text>
        </Box>
        <BoxButton
          $direction="row"
          $align="center"
          $gap="3xs"
          $theme="neutral"
          $variation="tertiary"
          onClick={() => window.location.reload()}
        >
          <Icon
            iconName="refresh"
            variant="symbols-outlined"
            $size="sm"
            $theme="neutral"
            $variation="tertiary"
          />
          <Text
            $size="sm"
            $weight={500}
            $theme="neutral"
            $variation="tertiary"
            $margin="0"
          >
            {t('Refresh page')}
          </Text>
        </BoxButton>
      </Box>
    </>
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return <StandalonePageLayout>{page}</StandalonePageLayout>;
};

export default Page;
