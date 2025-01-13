import type { ReactElement } from 'react';

import { MainLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';
import { DocsImportContainer } from '@/features/docs/docs-import/components/DocsImportContainer';

const Page: NextPageWithLayout = () => {
  return <DocsImportContainer />;
};

Page.getLayout = function getLayout(page: ReactElement) {
  return <MainLayout>{page}</MainLayout>;
};

export default Page;
