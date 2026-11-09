import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { DocShareModalFooter } from '../components/DocShareModalFooter';

const mocks = vi.hoisted(() => ({
  copyDocLink: vi.fn(),
}));

vi.mock('../components/DocVisibility', () => ({
  DocVisibility: () => <div data-testid="doc-visibility" />,
}));

vi.mock('@/docs/doc-management', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/docs/doc-management')>();

  return {
    ...actual,
    useCopyDocLink: () => mocks.copyDocLink,
  };
});

describe('DocShareModalFooter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderFooter = () =>
    render(
      <DocShareModalFooter
        doc={{ id: '123', title: 'My doc' } as never}
        onClose={vi.fn()}
      />,
      { wrapper: AppWrapper },
    );

  test('announces the copy confirmation through a status region', async () => {
    mocks.copyDocLink.mockResolvedValue(true);

    renderFooter();

    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(status).toBeEmptyDOMElement();

    await userEvent.click(screen.getByRole('button', { name: /copy link/i }));

    expect(mocks.copyDocLink).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(status).toHaveTextContent('Link Copied !'));
  });

  test('announces when copying the link failed', async () => {
    mocks.copyDocLink.mockResolvedValue(false);

    renderFooter();

    await userEvent.click(screen.getByRole('button', { name: /copy link/i }));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Failed to copy link',
      ),
    );
  });
});
