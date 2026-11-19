import { useRouter } from 'next/router';
import { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import Error502Svg from '@/assets/icons/error-502.svg';
import { ErrorPage } from '@/components';
import { StandalonePageLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';

const Page: NextPageWithLayout = () => {
  const { t } = useTranslation();
  const { query } = useRouter();
  const from = Array.isArray(query.from) ? query.from[0] : query.from;

  return (
    <ErrorPage
      illustration={<Error502Svg aria-hidden="true" />}
      title={t('Offline ?', { description: 'Heading of the offline page' })}
      description={t(
        "Can't load this page, please check your internet connection.",
        { description: 'Message of the offline page' },
      )}
      refreshTarget={from}
    />
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return <StandalonePageLayout>{page}</StandalonePageLayout>;
};

export default Page;
