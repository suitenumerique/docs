import Head from 'next/head';
import { useRouter } from 'next/router';
import { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { Error503 } from '@/features/errors';
import { StandalonePageLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';

const Page: NextPageWithLayout = () => {
  const { t } = useTranslation();
  const { query } = useRouter();
  const from = Array.isArray(query.from) ? query.from[0] : query.from;
  const refreshTarget =
    from?.startsWith('/') && !from.startsWith('//') ? from : undefined;

  return (
    <>
      <Head>
        <meta name="robots" content="noindex" />
        <title>{`${t('Error 503')} - ${t('Docs')}`}</title>
        <meta
          property="og:title"
          content={`${t('Error 503')} - ${t('Docs')}`}
          key="title"
        />
      </Head>
      <Error503 refreshTarget={refreshTarget} />
    </>
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return <StandalonePageLayout>{page}</StandalonePageLayout>;
};

export default Page;
