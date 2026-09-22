import Head from 'next/head';
import { useRouter } from 'next/router';
import { ReactElement, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import Error401Svg from '@/assets/icons/error-401.svg';
import { Box, Text } from '@/components';
import { ButtonLogin, useAuth } from '@/features/auth';
import { StandalonePageLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';

const HeaderAuthActions = () => {
  const { t } = useTranslation();

  return (
    <Box $direction="row" $align="center" $gap="sm">
      <ButtonLogin variant="tertiary">{t('Try it now')}</ButtonLogin>
      <ButtonLogin />
    </Box>
  );
};

const Page: NextPageWithLayout = () => {
  const { t } = useTranslation();
  const { authenticated } = useAuth();
  const { replace } = useRouter();
  const pageTitle = `${t('401 Unauthorized')} - ${t('Docs')}`;

  useEffect(() => {
    if (authenticated) {
      void replace(`/`);
    }
  }, [authenticated, replace]);

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
        className="--docs--error-401"
      >
        <Box $align="center" $gap="xxxs">
          <Error401Svg aria-hidden="true" />
          <Text
            as="h1"
            $size="md"
            $weight="bold"
            $textAlign="center"
            $margin="0"
            $theme="neutral"
            $variation="primary"
          >
            {t('Please sign in')}
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
            {t('You need to sign in before accessing the document')}
          </Text>
        </Box>
        <ButtonLogin />
      </Box>
    </>
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return (
    <StandalonePageLayout headerActions={<HeaderAuthActions />}>
      {page}
    </StandalonePageLayout>
  );
};

export default Page;
