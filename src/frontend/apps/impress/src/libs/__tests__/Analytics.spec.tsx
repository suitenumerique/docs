import { render, screen } from '@testing-library/react';
import React, { Fragment } from 'react';

import { AbstractAnalytic, Analytics, useAnalytics } from '@/libs';
import { AppWrapper } from '@/tests/utils';

class TestAnalytic1 extends AbstractAnalytic {
  public constructor() {
    super();
  }

  public Provider() {
    return <Fragment />;
  }

  public trackEvent() {}

  public isFeatureFlagActivated(flagName: string): boolean {
    if (flagName === 'test-flag') {
      return false;
    }

    if (flagName === 'test-flag2') {
      return true;
    }

    return true;
  }
}

class TestAnalytic2 extends AbstractAnalytic {
  public constructor() {
    super();
  }

  public Provider() {
    return <Fragment />;
  }

  public trackEvent() {}

  public isFeatureFlagActivated(): boolean {
    return true;
  }
}

const TestComponent = ({ flag }: { flag: string }) => {
  const { isFeatureFlagActivated } = useAnalytics();

  return (
    <div>
      {isFeatureFlagActivated(flag) ? (
        <span>Feature is enabled</span>
      ) : (
        <span>Feature is not enabled</span>
      )}
    </div>
  );
};

describe('Analytics feature flag', () => {
  beforeEach(() => {
    Analytics.clearAnalytics();
  });

  test('renders feature when feature flag is not existing', async () => {
    new TestAnalytic1();
    new TestAnalytic2();

    render(<TestComponent flag="unexisting-flag" />, {
      wrapper: AppWrapper,
    });
    expect(await screen.findByText('Feature is enabled')).toBeInTheDocument();
  });

  test('renders feature when feature flag is not enabled', async () => {
    new TestAnalytic1();
    new TestAnalytic2();

    render(<TestComponent flag="test-flag" />, {
      wrapper: AppWrapper,
    });
    expect(screen.getByText('Feature is not enabled')).toBeInTheDocument();
  });

  test('renders feature when feature flag is enabled', async () => {
    new TestAnalytic1();
    new TestAnalytic2();

    render(<TestComponent flag="test-flag2" />, {
      wrapper: AppWrapper,
    });
    expect(screen.getByText('Feature is enabled')).toBeInTheDocument();
  });
});
