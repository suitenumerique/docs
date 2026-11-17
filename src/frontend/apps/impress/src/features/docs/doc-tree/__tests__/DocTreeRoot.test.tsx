import { TreeContextType } from '@gouvfr-lasuite/ui-components';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Doc } from '@/docs/doc-management';
import { useResponsiveStore } from '@/stores';
import { AppWrapper } from '@/tests/utils';

import { DocTreeRoot } from '../components/DocTreeRoot';

const mocks = vi.hoisted(() => ({
  focusMainContentStart: vi.fn(),
  onPortalButtonClick: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('@/layouts/utils', () => ({
  focusMainContentStart: mocks.focusMainContentStart,
}));

vi.mock('../components/DocTreeItemActions', async () => {
  const { createElement } = await import('react');
  const { createPortal } = await import('react-dom');

  return {
    DocTreeItemActions: () =>
      createPortal(
        [
          createElement(
            'button',
            {
              key: 'button',
              type: 'button',
              onClick: mocks.onPortalButtonClick,
            },
            'Cancel the download',
          ),
          createElement(
            'label',
            { key: 'checkbox' },
            createElement('input', { type: 'checkbox', defaultChecked: true }),
            'Duplicate subdocs',
          ),
        ],
        document.body,
      ),
  };
});

const doc = { id: 'doc-1', title: 'Roadmap' } as Doc;

const treeContext = {
  root: doc,
  treeApiRef: { current: null },
  treeData: { selectedNode: doc, setSelectedNode: vi.fn() },
} as unknown as TreeContextType<Doc | null>;

describe('DocTreeRoot', () => {
  it('ignores Enter and Space bubbled from a portal outside the item', async () => {
    const user = userEvent.setup();
    // Actions stay mounted without a hover, so the portaled button is there.
    useResponsiveStore.setState({ isMobile: true });

    render(
      <DocTreeRoot
        currentDoc={doc}
        rootItemRef={createRef()}
        treeContext={treeContext}
      />,
      { wrapper: AppWrapper },
    );

    await user.click(
      screen.getByRole('button', { name: 'Cancel the download' }),
    );
    mocks.onPortalButtonClick.mockClear();

    await user.keyboard('{Enter}');
    expect(mocks.onPortalButtonClick).toHaveBeenCalledTimes(1);

    await user.keyboard(' ');
    expect(mocks.onPortalButtonClick).toHaveBeenCalledTimes(2);

    expect(mocks.focusMainContentStart).not.toHaveBeenCalled();
  });

  it('lets a checkbox in a portal outside the item be toggled', async () => {
    const user = userEvent.setup();
    useResponsiveStore.setState({ isMobile: true });
    mocks.push.mockClear();

    render(
      <DocTreeRoot
        currentDoc={doc}
        rootItemRef={createRef()}
        treeContext={treeContext}
      />,
      { wrapper: AppWrapper },
    );

    const checkbox = screen.getByRole('checkbox', {
      name: 'Duplicate subdocs',
    });
    expect(checkbox).toBeChecked();

    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();

    await user.click(screen.getByText('Duplicate subdocs'));
    expect(checkbox).toBeChecked();

    // The click must not reach the link of the root doc either
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
