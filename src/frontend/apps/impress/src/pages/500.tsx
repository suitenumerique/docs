import { useRouter } from 'next/router';
import { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import Error500Svg from '@/assets/icons/error-500.svg';
import { ErrorPage } from '@/components';
import { StandalonePageLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';

const Page: NextPageWithLayout = () => {
  const { t } = useTranslation();
  const { query } = useRouter();
  const from = Array.isArray(query.from) ? query.from[0] : query.from;

  return (
    <ErrorPage
      illustration={<Error500Svg aria-hidden="true" />}
      title={t('Error 500', {
        description: 'Heading of the server error page',
      })}
      description={t(
        'An unexpected error occurred. Go grab a coffee or try to refresh the page.',
        { description: 'Message of the server error page, informal tone' },
      )}
      refreshTarget={from}
    />
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return <StandalonePageLayout>{page}</StandalonePageLayout>;
};

export default Page;
