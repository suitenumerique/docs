import { Loader } from '@openfun/cunningham-react';
import { ReactElement, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Text } from '@/components';
import { useImportNotion } from '@/features/docs/doc-management/api/useImportNotion';
import { MainLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';

const Page: NextPageWithLayout = () => {
  const { t } = useTranslation();

  const { mutate: importNotion } = useImportNotion();

  useEffect(() => {
    importNotion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box
      $padding={{ top: 'large' }}
      $width="100%"
      $height="100%"
      $align="center"
    >
      <Text as="p" $margin={{ bottom: '0px' }}>
        {t('Notion import in progress...')}
      </Text>
      <Text as="p" $margin={{ top: '10px', bottom: '30px' }}>
        {t('Please stay on this page and be patient')}
      </Text>
      <Loader />
    </Box>
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return <MainLayout>{page}</MainLayout>;
};

export default Page;
