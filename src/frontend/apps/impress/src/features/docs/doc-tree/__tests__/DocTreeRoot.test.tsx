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
}));

vi.mock('next/router', () => ({
  useRouter: () => ({ push: vi.fn() }),
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
        createElement('button', { type: 'button' }, 'Cancel the download'),
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
  it('ignores Enter bubbled from a portal outside the item', async () => {
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
    await user.keyboard('{Enter}');

    expect(mocks.focusMainContentStart).not.toHaveBeenCalled();
  });
});
