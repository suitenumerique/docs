import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Loading } from '@/components';
import { useConfig } from '@/core';
import { gotoLogin, useAuth } from '@/features/auth';
import { HomeContent } from '@/features/home';
import { NextPageWithLayout } from '@/types/next';

const Page: NextPageWithLayout = () => {
  const { t } = useTranslation();
  const { authenticated, isAuthLoading } = useAuth();
  const { data: config, isFetched: isConfigFetched } = useConfig();
  const { replace } = useRouter();
  const homepageDisabled =
    isConfigFetched && !config?.FRONTEND_HOMEPAGE_FEATURE_ENABLED;

  /**
   * If the user is authenticated we redirect him to the index page (grid).
   */
  useEffect(() => {
    if (!authenticated) {
      return;
    }

    void replace('/');
  }, [authenticated, replace]);

  /**
   * If the homepage feature is disabled, the homepage should not be reachable
   * even from a direct link, so we redirect the user to the login page — the
   * same behavior as visiting `/` (see the `Auth` component). We wait for the
   * config to be fetched so a pending flag is not mistaken for a disabled one.
   */
  useEffect(() => {
    if (isAuthLoading || authenticated || !homepageDisabled) {
      return;
    }

    gotoLogin(false);
  }, [isAuthLoading, authenticated, homepageDisabled]);

  if (isAuthLoading || authenticated || !isConfigFetched || homepageDisabled) {
    return <Loading $height="100vh" $width="100vw" />;
  }

  return (
    <>
      <Head>
        <title>{`${t('Home')} - ${t('Docs')}`}</title>
        <meta
          property="og:title"
          content={`${t('Home')} - ${t('Docs')}`}
          key="title"
        />
      </Head>
      <HomeContent />
    </>
  );
};

export default Page;
