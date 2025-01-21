import { Router } from 'next/router';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { PropsWithChildren, useEffect } from 'react';

export interface PostHogConf {
  id: string;
  host: string;
}

interface PostHogProviderProps {
  conf?: PostHogConf;
}

export function PostHogProvider({
  children,
  conf,
}: PropsWithChildren<PostHogProviderProps>) {
  useEffect(() => {
    if (!conf?.id || !conf?.host || posthog.__loaded) {
      return;
    }

    posthog.init(conf.id, {
      api_host: conf.host,
      person_profiles: 'always',
      loaded: (posthog) => {
        if (process.env.NODE_ENV === 'development') {
          posthog.debug();
        }
      },
      capture_pageview: false,
      capture_pageleave: true,
    });

    const handleRouteChange = () => posthog?.capture('$pageview');

    Router.events.on('routeChangeComplete', handleRouteChange);

    return () => {
      Router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [conf?.host, conf?.id]);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
