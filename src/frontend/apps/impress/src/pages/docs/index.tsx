import { useSearchParams } from 'next/navigation';
import type { ReactElement } from 'react';

import { Box } from '@/components';
import { DocDefaultFilter } from '@/features/docs';
import { DocsGrid } from '@/features/docs/docs-grid/components/DocsGrid';
import { MainLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';

const Page: NextPageWithLayout = () => {
  const searchParams = useSearchParams();
  const target = searchParams.get('target');

  return (
    <Box $width="100%" $align="center">
      <DocsGrid target={target as DocDefaultFilter} />
    </Box>
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return <MainLayout backgroundColor="grey">{page}</MainLayout>;
};

export default Page;
