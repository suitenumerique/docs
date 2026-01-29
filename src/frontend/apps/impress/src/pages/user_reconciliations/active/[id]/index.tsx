import Head from 'next/head';
import { useRouter } from 'next/router';
import { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { UserReconciliation } from '@/features/auth/components/UserReconciliation';
import { PageLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';

const Page: NextPageWithLayout = () => {
  const { t } = useTranslation();
  const {
    query: { id },
  } = useRouter();

  if (typeof id !== 'string') {
    return null;
  }

  return (
    <>
      <Head>
        <meta name="robots" content="noindex" />
        <title>{`${t('User reconciliation')} - ${t('Docs')}`}</title>
        <meta
          property="og:title"
          content={`${t('User reconciliation')} - ${t('Docs')}`}
          key="title"
        />
      </Head>
      <UserReconciliation type="active" reconciliationId={id} />
    </>
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return <PageLayout withFooter={false}>{page}</PageLayout>;
};

export default Page;
