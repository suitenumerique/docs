import { Button } from '@gouvfr-lasuite/cunningham-react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { ReactElement, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import ErrorAccessDeniedSvg from '@/assets/icons/Docs Locked.svg';
import { Box, Text } from '@/components';
import { gotoLogin, useAuth } from '@/features/auth';
import { PageLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';

const Page: NextPageWithLayout = () => {
  const { t } = useTranslation();
  const { authenticated } = useAuth();
  const { replace } = useRouter();

  useEffect(() => {
    if (authenticated) {
      void replace(`/`);
    }
  }, [authenticated, replace]);

  return (
    <>
      <Head>
        <meta name="robots" content="noindex" />
        <title>{`${t('Access denied')} - ${t('Docs')}`}</title>
        <meta
          property="og:title"
          content={`${t('Access denied')} - ${t('Docs')}`}
          key="title"
        />
      </Head>
      <Box
        $align="center"
        $justify="center"
        $flex="1"
        $gap="var(--xxxs, 4px)"
        $padding={{ bottom: '2rem' }}
      >
        <Text as="h1" $textAlign="center" className="sr-only">
          {t('Access denied')} - {t('Docs')}
        </Text>
        <ErrorAccessDeniedSvg width={102} height={72} aria-hidden="true" />

        <Box $align="center" $gap="0">
          <Text as="p" $weight="bold" $textAlign="center" $margin="0">
            {t('Access denied')}
          </Text>

          <Text
            as="p"
            $textAlign="center"
            $maxWidth="350px"
            $margin="0"
            $css="
              color: var(--c--contextuals--content--semantic--neutral--secondary);
              font-size: 12px;
              font-weight: 400;
              line-height: var(--line-height-xs, 16px);
              margin-top: 4px;
            "
          >
            {t('Sign in to access the document.')}
          </Text>
        </Box>

        <Box $css="margin-top: var(--base, 16px);">
          <Button
            onClick={() => gotoLogin(false)}
            aria-label={t('Sign in')}
            size="small"
          >
            {t('Sign in')}
          </Button>
        </Box>
      </Box>
    </>
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return <PageLayout withFooter={false}>{page}</PageLayout>;
};

export default Page;
