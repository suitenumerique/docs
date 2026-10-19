import Head from 'next/head';
import { useRouter } from 'next/router';
import { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { UserReconciliation } from '@/features/auth/components/UserReconciliation';
import { StandalonePageLayout } from '@/layouts';
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
        <title>{`${t('User reconciliation', { description: 'Page title of the account merge pages' })} - ${t('Docs', { description: 'Product name, shown in page titles and the logo' })}`}</title>
        <meta
          property="og:title"
          content={`${t('User reconciliation', { description: 'Page title of the account merge pages' })} - ${t('Docs', { description: 'Product name, shown in page titles and the logo' })}`}
          key="title"
        />
      </Head>
      <UserReconciliation type="inactive" reconciliationId={id} />
    </>
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return <StandalonePageLayout>{page}</StandalonePageLayout>;
};

export default Page;
