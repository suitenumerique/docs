import * as Sentry from '@sentry/nextjs';
import { NextPageContext } from 'next';
import NextError from 'next/error';
import { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import Error500Svg from '@/assets/icons/error-500.svg';
import { ErrorPage } from '@/components';
import { PageLayout } from '@/layouts';

const Error = () => {
  const { t } = useTranslation();

  return (
    <ErrorPage
      illustration={<Error500Svg aria-hidden="true" />}
      title={t('An unexpected error occurred.', {
        description: 'Generic error page title and message',
      })}
      description={t(
        'An unexpected error occurred. Go grab a coffee or try to refresh the page.',
        { description: 'Message of the server error page, informal tone' },
      )}
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
