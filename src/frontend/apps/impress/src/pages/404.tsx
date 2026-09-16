import Head from 'next/head';
import { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { Error404 } from '@/features/errors';
import { StandalonePageLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';

const Page: NextPageWithLayout = () => {
  const { t } = useTranslation();

  return (
    <>
      <Head>
        <title>{`${t('Error 404')} - ${t('Docs')}`}</title>
        <meta
          property="og:title"
          content={`${t('Error 404')} - ${t('Docs')}`}
          key="title"
        />
      </Head>
      <Error404 />
    </>
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return <StandalonePageLayout>{page}</StandalonePageLayout>;
};

export default Page;
