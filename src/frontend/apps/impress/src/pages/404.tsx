import { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import Error404Svg from '@/assets/icons/404.svg';
import { ErrorPage } from '@/components';
import { PageLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';

const Page: NextPageWithLayout = () => {
  const { t } = useTranslation();

  return (
    <ErrorPage
      icon={Error404Svg}
      title={t('Error 404')}
      description={t(
        'It seems that the page you are looking for does not exist or cannot be displayed correctly.',
      )}
      showReload={false}
    />
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return <PageLayout withFooter={false}>{page}</PageLayout>;
};

export default Page;
