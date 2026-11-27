import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { ToastActions } from '../ConfirmationDuplicateModal';

vi.mock('next/router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    pathname: '/',
  }),
}));

describe('<ToastActions />', () => {
  test('leaves the focus where it was when the toast shows', () => {
    render(
      <ToastActions
        isTopRoot={false}
        onDismiss={vi.fn()}
        duplicatedDocId="copy-id"
        originalDocId="doc-id"
        treeContext={null}
      />,
      { wrapper: AppWrapper },
    );

    expect(
      screen.getByRole('link', { name: 'Back to original' }),
    ).not.toHaveFocus();
    expect(screen.getByRole('button', { name: 'Undo' })).not.toHaveFocus();
  });
});
