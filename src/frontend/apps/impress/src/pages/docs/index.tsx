import Head from 'next/head';
import { useSearchParams } from 'next/navigation';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { DocDefaultFilter, useTrans } from '@/docs/doc-management';
import { DocsGrid } from '@/docs/docs-grid';
import { HeaderFloatingBar } from '@/features/header/components/HeaderFloatingBar';
import { MainLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';

const Page: NextPageWithLayout = () => {
  const { t } = useTranslation();
  const { transFilter } = useTrans();
  const searchParams = useSearchParams();
  const target =
    (searchParams.get('target') as DocDefaultFilter) ??
    DocDefaultFilter.ALL_DOCS;
  const pageTitle = transFilter(target);

  return (
    <>
      <Head>
        <title>{`${pageTitle} - ${t('Docs')}`}</title>
        <meta
          property="og:title"
          content={`${pageTitle} - ${t('Docs')}`}
          key="title"
        />
      </Head>
      <HeaderFloatingBar />
      <DocsGrid target={target} />
    </>
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return (
    <MainLayout
      propsContent={{
        $background:
          'linear-gradient(53deg, var(--c--contextuals--background--surface--primary) 39.96%, var(--c--contextuals--background--semantic--brand--tertiary) 125.64%)',
      }}
    >
      {page}
    </MainLayout>
  );
};

export default Page;
