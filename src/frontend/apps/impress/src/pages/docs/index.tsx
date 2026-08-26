import Head from 'next/head';
import { useSearchParams } from 'next/navigation';
import type { PropsWithChildren, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { DocDefaultFilter, useTrans } from '@/docs/doc-management';
import { DocsGrid } from '@/docs/docs-grid';
import { HeaderFloatingBar } from '@/features/header/components/HeaderFloatingBar';
import { MainLayout } from '@/layouts';
import { useResponsiveStore } from '@/stores/useResponsiveStore';
import { NextPageWithLayout } from '@/types/next';

const Page: NextPageWithLayout = () => {
  const { t } = useTranslation();
  const { transFilter } = useTrans();
  const { isDesktop } = useResponsiveStore();
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
      <HeaderFloatingBar
        $css={
          isDesktop
            ? css`
                &::before {
                  background: transparent;
                }
              `
            : undefined
        }
      />
      <DocsGrid target={target} />
    </>
  );
};

const DocsPageLayout = ({ children }: PropsWithChildren) => {
  const { isDesktop } = useResponsiveStore();

  return (
    <MainLayout
      propsContent={{
        $background: !isDesktop
          ? 'var(--c--contextuals--background--surface--primary)'
          : 'linear-gradient(53deg, var(--c--contextuals--background--surface--primary) 39.96%, var(--c--contextuals--background--semantic--brand--tertiary) 125.64%)',
      }}
    >
      {children}
    </MainLayout>
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return <DocsPageLayout>{page}</DocsPageLayout>;
};

export default Page;
