import { Button } from '@openfun/cunningham-react';
import * as Sentry from '@sentry/nextjs';
import { NextPageContext } from 'next';
import NextError from 'next/error';
import Head from 'next/head';
import Image from 'next/image';
import { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import error_img from '@/assets/icons/error-planetes.png';
import { Box, Icon, StyledLink, Text } from '@/components';
import { PageLayout } from '@/layouts';

const StyledButton = styled(Button)`
  width: fit-content;
`;

const Error = () => {
  const { t } = useTranslation();

  const errorTitle = t('An unexpected error occurred.');

  return (
    <>
      <Head>
        <title>
          {errorTitle} - {t('Docs')}
        </title>
        <meta
          property="og:title"
          content={`${errorTitle} - ${t('Docs')}`}
          key="title"
        />
      </Head>
      <Box
        $align="center"
        $margin="auto"
        $gap="md"
        $padding={{ bottom: '2rem' }}
      >
        <Text as="h2" $textAlign="center" className="sr-only">
          {errorTitle} - {t('Docs')}
        </Text>
        <Image
          src={error_img}
          alt=""
          width={300}
          style={{
            maxWidth: '100%',
            height: 'auto',
          }}
        />

        <Text
          as="p"
          $textAlign="center"
          $maxWidth="350px"
          $theme="neutral"
          $margin="0"
        >
          {errorTitle}
        </Text>

        <Box $direction="row" $gap="sm">
          <StyledLink href="/">
            <StyledButton
              color="neutral"
              icon={
                <Icon
                  iconName="house"
                  variant="symbols-outlined"
                  $withThemeInherited
                />
              }
            >
              {t('Home')}
            </StyledButton>
          </StyledLink>

          <StyledButton
            color="neutral"
            variant="bordered"
            icon={
              <Icon
                iconName="refresh"
                variant="symbols-outlined"
                $withThemeInherited
              />
            }
            onClick={() => window.location.reload()}
          >
            {t('Refresh page')}
          </StyledButton>
        </Box>
      </Box>
    </>
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
  return <PageLayout withFooter={false}>{page}</PageLayout>;
};

export default Error;
