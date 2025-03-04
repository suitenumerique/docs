import { Loader } from '@openfun/cunningham-react';
import { PropsWithChildren, useEffect } from 'react';

import { Box } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { CrispProvider, PostHogProvider } from '@/services';
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

  if (!conf) {
    return (
      <Box $height="100vh" $width="100vw" $align="center" $justify="center">
        <Loader />
      </Box>
    );
  }

  return (
    <PostHogProvider conf={conf.POSTHOG_KEY}>
      <CrispProvider websiteId={conf?.CRISP_WEBSITE_ID}>
        {children}
      </CrispProvider>
    </PostHogProvider>
  );
};
