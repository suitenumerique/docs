import { Loader } from '@openfun/cunningham-react';
import { PropsWithChildren, useEffect } from 'react';

import { Box } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { PostHogProvider, configureCrispSession } from '@/services';
import { useSentryStore } from '@/stores/useSentryStore';

import { useConfig } from './api/useConfig';

export const ConfigProvider = ({ children }: PropsWithChildren) => {
  const { data: conf } = useConfig();
  const { setSentry } = useSentryStore();
  const { setTheme } = useCunninghamTheme();

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
    if (!conf?.CRISP_WEBSITE_ID) {
      return;
    }

    configureCrispSession(conf.CRISP_WEBSITE_ID);
  }, [conf?.CRISP_WEBSITE_ID]);

  if (!conf) {
    return (
      <Box $height="100vh" $width="100vw" $align="center" $justify="center">
        <Loader />
      </Box>
    );
  }

  return <PostHogProvider conf={conf.POSTHOG_KEY}>{children}</PostHogProvider>;
};
