import { Button } from '@openfun/cunningham-react';
import Head from 'next/head';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { ReactElement, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import img401 from '@/assets/icons/icon-401.png';
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
        <title>{`${t('401 Unauthorized')} - ${t('Docs')}`}</title>
        <meta
          property="og:title"
          content={`${t('401 Unauthorized')} - ${t('Docs')}`}
          key="title"
        />
      </Head>
      <Box
        $align="center"
        $margin="auto"
        $gap="1rem"
        $padding={{ bottom: '2rem' }}
      >
        <Text as="h1" $textAlign="center" className="sr-only">
          {t('401 Unauthorized')} - {t('Docs')}
        </Text>
        <Image
          className="c__image-system-filter"
          src={img401}
          alt=""
          width={300}
          height={300}
          style={{
            maxWidth: '100%',
            height: 'auto',
          }}
        />

        <Box $align="center" $gap="0.8rem">
          <Text as="p" $textAlign="center" $maxWidth="350px" $theme="primary">
            {t('Log in to access the document.')}
          </Text>

          <Button onClick={() => gotoLogin(false)} aria-label={t('Login')}>
            {t('Login')}
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
