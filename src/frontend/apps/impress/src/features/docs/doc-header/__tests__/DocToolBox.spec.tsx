import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { Fragment } from 'react';
import { beforeEach, describe, expect, vi } from 'vitest';

import { AbstractAnalytic, Analytics } from '@/libs';
import { AppWrapper } from '@/tests/utils';

import { DocToolBox } from '../components/DocToolBox';

let flag = true;
class TestAnalytic extends AbstractAnalytic {
  public constructor() {
    super();
  }

  public Provider() {
    return <Fragment />;
  }

  public trackEvent() {}

  public isFeatureFlagActivated(flagName: string): boolean {
    if (flagName === 'CopyAsHTML') {
      return flag;
    }

    return true;
  }
}

vi.mock('next/router', async () => ({
  ...(await vi.importActual('next/router')),
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

const doc = {
  nb_accesses: 1,
  abilities: {
    versions_list: true,
    destroy: true,
  },
};

beforeEach(() => {
  Analytics.clearAnalytics();
  process.env.NEXT_PUBLIC_PUBLISH_AS_MIT = 'false';
});

describe('DocToolBox "Copy as HTML" option', () => {
  test('renders "Copy as HTML" option when feature flag is enabled', async () => {
    new TestAnalytic();

    render(<DocToolBox doc={doc as any} />, {
      wrapper: AppWrapper,
    });
    const optionsButton = await screen.findByLabelText(
      'Open the document options',
    );
    await userEvent.click(optionsButton);
    expect(await screen.findByText('Copy as HTML')).toBeInTheDocument();
  });

  test('does not render "Copy as HTML" option when feature flag is disabled', async () => {
    flag = false;
    new TestAnalytic();

    render(<DocToolBox doc={doc as any} />, {
      wrapper: AppWrapper,
    });
    const optionsButton = screen.getByLabelText('Open the document options');
    await userEvent.click(optionsButton);
    expect(screen.queryByText('Copy as HTML')).not.toBeInTheDocument();
  });

  test('render "Copy as HTML" option when we did not add analytics', async () => {
    render(<DocToolBox doc={doc as any} />, {
      wrapper: AppWrapper,
    });
    const optionsButton = screen.getByLabelText('Open the document options');
    await userEvent.click(optionsButton);
    expect(screen.getByText('Copy as HTML')).toBeInTheDocument();
  });
});
