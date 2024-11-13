import type { ReactElement } from 'react';

import { Box } from '@/components';
import { DocsGrid } from '@/features/docs/docs-grid/components/DocsGrid';
import { MainLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';

const Page: NextPageWithLayout = () => {
  return (
    <Box $width="100%">
      <DocsGrid />
    </Box>
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return <MainLayout backgroundColor="grey">{page}</MainLayout>;
};

export default Page;
