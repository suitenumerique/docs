import * as Sentry from '@sentry/nextjs';
import { NextPageContext } from 'next';
import NextError from 'next/error';
import { ReactElement } from 'react';

import { UnexpectedErrorPage } from '@/components';
import { PageLayout } from '@/layouts';

const Error = () => <UnexpectedErrorPage />;

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
