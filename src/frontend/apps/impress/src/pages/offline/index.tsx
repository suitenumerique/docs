import { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import Error503Svg from '@/assets/icons/503.svg';
import { ErrorPage, ErrorPageFooter, ErrorPageHeader } from '@/components';
import { PageLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';

const Page: NextPageWithLayout = () => {
  const { t } = useTranslation();

  return (
    <ErrorPage
      icon={Error503Svg}
      title={t('Error 503')}
      description={t('The server is temporarily overloaded or unavailable')}
      showHome={false}
      showReload
    />
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return (
    <PageLayout
      withFooter={false}
      withLeftPanel={false}
      headerSlot={<ErrorPageHeader />}
      footerSlot={<ErrorPageFooter />}
    >
      {page}
    </PageLayout>
  );
};

export default Page;
