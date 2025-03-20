import { JSX, PropsWithChildren, ReactNode } from 'react';

type AnalyticEventClick = {
  eventName: 'click';
};
type AnalyticEventUser = {
  eventName: 'user';
  id: string;
  email: string;
};

export type AnalyticEvent = AnalyticEventClick | AnalyticEventUser;

export abstract class AbstractAnalytic {
  public constructor() {
    Analytics.registerAnalytic(this);
  }

  public abstract Provider(children: ReactNode): JSX.Element;

  public abstract trackEvent(evt: AnalyticEvent): void;

  public abstract isFeatureFlagActivated(flagName: string): boolean;
}

export class Analytics {
  private static analytics: AbstractAnalytic[] = [];

  public static clearAnalytics(): void {
    Analytics.analytics = [];
  }

  public static registerAnalytic(analytic: AbstractAnalytic): void {
    Analytics.analytics.push(analytic);
  }

  public static trackEvent(evt: AnalyticEvent): void {
    Analytics.analytics.forEach((analytic) => analytic.trackEvent(evt));
  }

  public static providers(children: ReactNode) {
    return Analytics.analytics.reduceRight(
      (acc, analytic) => analytic.Provider(acc),
      children,
    );
  }

  /**
   * Check if a feature flag is activated
   *
   * Feature flags are activated if at least one analytic is activated
   * because we don't want to hide feature if the user does not
   * use analytics (AB testing, etc)
   */
  public static isFeatureFlagActivated(flagName: string): boolean {
    if (!Analytics.analytics.length) {
      return true;
    }

    return Analytics.analytics.some((analytic) =>
      analytic.isFeatureFlagActivated(flagName),
    );
  }
}

const AnalyticsProvider = ({ children }: PropsWithChildren) => {
  return Analytics.providers(children);
};

const isFeatureFlagActivated = (flagName: string) =>
  Analytics.isFeatureFlagActivated(flagName);

const trackEvent = (evt: AnalyticEvent) => Analytics.trackEvent(evt);

export const useAnalytics = () => {
  return {
    AnalyticsProvider,
    isFeatureFlagActivated,
    trackEvent,
  };
};
