import { Router } from 'next/router';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { JSX, PropsWithChildren, ReactNode, useEffect } from 'react';

import { useIsOffline } from '@/features/service-worker/hooks/useOffline';
import { AbstractAnalytic, AnalyticEvent } from '@/libs/';

export class PostHogAnalytic extends AbstractAnalytic {
  private conf?: PostHogConf = undefined;

  public constructor(conf?: PostHogConf) {
    super();

    this.conf = conf;
  }

  public Provider(children?: ReactNode): JSX.Element {
    return <PostHogProvider conf={this.conf}>{children}</PostHogProvider>;
  }

  public trackEvent(evt: AnalyticEvent): void {
    if (evt.eventName === 'user') {
      posthog.identify(evt.id, { email: evt.email });
    }
  }

  public isFeatureFlagActivated(flagName: string): boolean {
    return !(
      posthog.featureFlags.getFlags().includes(flagName) &&
      posthog.isFeatureEnabled(flagName) === false
    );
  }
}

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
  const isOffline = useIsOffline((state) => state.isOffline);

  useEffect(() => {
    if (!conf?.id || !conf?.host || posthog.__loaded) {
      return;
    }

    posthog.init(conf.id, {
      api_host: conf.host,
      person_profiles: 'always',
      loaded: (posthogInstance) => {
        if (process.env.NODE_ENV === 'development') {
          posthogInstance.debug();
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

  // Disable PostHog when offline to prevent retry requests
  useEffect(() => {
    if (isOffline) {
      posthog.opt_out_capturing();
    } else {
      posthog.opt_in_capturing();
    }
  }, [isOffline]);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
