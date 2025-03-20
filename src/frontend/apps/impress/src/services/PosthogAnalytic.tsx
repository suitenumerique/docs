import { Router } from 'next/router';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { JSX, PropsWithChildren, ReactNode, useEffect } from 'react';

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
    if (
      posthog.featureFlags.getFlags().includes(flagName) &&
      posthog.isFeatureEnabled(flagName) === false
    ) {
      return false;
    }

    return true;
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
