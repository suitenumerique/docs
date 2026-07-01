import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { PresenterFloatingBar } from '../components/PresenterFloatingBar';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const noop = () => undefined;

describe('PresenterFloatingBar', () => {
  test('opens the grouped actions dropdown from the toolbar button', async () => {
    render(
      <PresenterFloatingBar
        index={0}
        total={3}
        isFullscreen={false}
        onPrev={noop}
        onNext={noop}
        onCopyLink={noop}
        onToggleFullscreen={noop}
        onClose={noop}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'More options' }));

    expect(
      screen.getByRole('menuitem', { name: 'Copy link to slide' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('menuitem', { name: 'Download PDF' }),
    ).not.toBeInTheDocument();
  });
});
