import { Loader } from '@openfun/cunningham-react';
import Head from 'next/head';
import { PropsWithChildren, useEffect } from 'react';

import { Box } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { useLanguageSynchronizer } from '@/features/language/';
import { useAnalytics } from '@/libs';
import { CrispProvider, PostHogAnalytic } from '@/services';
import { useSentryStore } from '@/stores/useSentryStore';

import { useConfig } from './api/useConfig';

export const ConfigProvider = ({ children }: PropsWithChildren) => {
  const { data: conf } = useConfig();
  const { setSentry } = useSentryStore();
  const { setTheme } = useCunninghamTheme();
  const { AnalyticsProvider } = useAnalytics();
  const { synchronizeLanguage } = useLanguageSynchronizer();

  useEffect(() => {
    if (!conf?.SENTRY_DSN) {
      return;
    }

    setSentry(conf.SENTRY_DSN, conf.ENVIRONMENT);
  }, [conf?.SENTRY_DSN, conf?.ENVIRONMENT, setSentry]);

  useEffect(() => {
    if (!conf?.FRONTEND_THEME) {
      return;
    }

    setTheme(conf.FRONTEND_THEME);
  }, [conf?.FRONTEND_THEME, setTheme]);

  useEffect(() => {
    void synchronizeLanguage();
  }, [synchronizeLanguage]);

  useEffect(() => {
    if (!conf?.POSTHOG_KEY) {
      return;
    }

    new PostHogAnalytic(conf.POSTHOG_KEY);
  }, [conf?.POSTHOG_KEY]);

  if (!conf) {
    return (
      <Box $height="100vh" $width="100vw" $align="center" $justify="center">
        <Loader />
      </Box>
    );
  }

  return (
    <>
      {conf?.FRONTEND_CSS_URL && (
        <Head>
          <link rel="stylesheet" href={conf?.FRONTEND_CSS_URL} />
        </Head>
      )}
      <AnalyticsProvider>
        <CrispProvider websiteId={conf?.CRISP_WEBSITE_ID}>
          {children}
        </CrispProvider>
      </AnalyticsProvider>
    </>
  );
};
