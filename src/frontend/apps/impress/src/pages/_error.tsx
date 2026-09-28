import * as Sentry from '@sentry/nextjs';
import { NextPageContext } from 'next';
import NextError from 'next/error';
import { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import error_img from '@/assets/icons/error-planetes.png';
import { ErrorPage } from '@/components';
import { PageLayout } from '@/layouts';

const Error = () => {
  const { t } = useTranslation();

  return (
    <ErrorPage
      image={error_img}
      description={t('An unexpected error occurred.')}
      showReload
    />
  );
};

Error.getInitialProps = async (contextData: NextPageContext) => {
  const { res, err, asPath, pathname, query } = contextData;

  Sentry.captureException(err, {
    contexts: {
      nextjs: {
        page: pathname,
        path: asPath,
        query: query,
        statusCode: res?.statusCode || err?.statusCode,
      },
    },
    tags: {
      errorPage: '_error.tsx',
      statusCode: String(res?.statusCode || err?.statusCode || 'unknown'),
    },
  });

  return NextError.getInitialProps(contextData);
};

Error.getLayout = function getLayout(page: ReactElement) {
  return (
    <PageLayout withFooter={false} withLeftPanel={false}>
      {page}
    </PageLayout>
  );
};

export default Error;
