import { Button } from '@gouvfr-lasuite/ui-components';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import Error502Svg from '@/assets/icons/error-502.svg';
import { Box, Text } from '@/components';
import RetrySvg from '@/icons/retry.svg';
import { StandalonePageLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';
import { getSafeRefreshUrl } from '@/utils/url';

const ACTION_ICON_SIZE = 16;

const Page: NextPageWithLayout = () => {
  const { t } = useTranslation();
  const { query, push } = useRouter();
  const from = Array.isArray(query.from) ? query.from[0] : query.from;
  const pageTitle = `${t('Offline', {
    description: 'Page title when there is no internet connection',
  })} - ${t('Docs', {
    description: 'Product name, shown in page titles and the logo',
  })}`;

  const handleRefresh = () => {
    const refreshTarget = getSafeRefreshUrl(from);
    if (!refreshTarget) {
      window.location.reload();
      return;
    }
    void push(refreshTarget);
  };

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta property="og:title" content={pageTitle} key="title" />
      </Head>
      <Box
        $align="center"
        $gap="base"
        $padding={{ horizontal: 'base', bottom: 'lg' }}
        className="--docs--error-502"
      >
        <Box $align="center" $gap="xxxs">
          <Error502Svg aria-hidden="true" />
          <Text
            as="h1"
            $size="md"
            $weight="bold"
            $textAlign="center"
            $margin="0"
            $theme="neutral"
            $variation="primary"
          >
            {t('Offline ?', { description: 'Heading of the offline page' })}
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
            {t("Can't load this page, please check your internet connection.", {
              description: 'Message of the offline page',
            })}
          </Text>
        </Box>
        <Button
          color="neutral"
          variant="tertiary"
          size="nano"
          icon={
            <RetrySvg
              width={ACTION_ICON_SIZE}
              height={ACTION_ICON_SIZE}
              aria-hidden="true"
            />
          }
          onClick={handleRefresh}
        >
          {t('Refresh page')}
        </Button>
      </Box>
    </>
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return <StandalonePageLayout>{page}</StandalonePageLayout>;
};

export default Page;
