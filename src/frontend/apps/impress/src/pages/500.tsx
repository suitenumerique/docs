import { useRouter } from 'next/router';
import { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import error_img from '@/assets/icons/error-coffee.png';
import { ErrorPage } from '@/components';
import { PageLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';

const Page: NextPageWithLayout = () => {
  const { t } = useTranslation();
  const { query } = useRouter();
  const from = Array.isArray(query.from) ? query.from[0] : query.from;
  const refreshTarget =
    from?.startsWith('/') && !from.startsWith('//') ? from : undefined;

  return (
    <ErrorPage
      image={error_img}
      description={t(
        'An unexpected error occurred. Go grab a coffee or try to refresh the page.',
      )}
      refreshTarget={refreshTarget}
    />
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return <PageLayout withFooter={false}>{page}</PageLayout>;
};

export default Page;
