import { useSearchParams } from 'next/navigation';
import type { ReactElement } from 'react';

import { DocsGrid } from '@/docs/docs-grid';
import { DocDefaultFilter } from '@/features/docs';
import { MainLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';

const Page: NextPageWithLayout = () => {
  const searchParams = useSearchParams();
  const target = searchParams.get('target');

  return <DocsGrid target={target as DocDefaultFilter} />;
};

Page.getLayout = function getLayout(page: ReactElement) {
  return <MainLayout backgroundColor="grey">{page}</MainLayout>;
};

export default Page;
