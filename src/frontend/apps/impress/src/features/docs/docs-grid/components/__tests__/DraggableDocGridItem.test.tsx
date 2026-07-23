import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Doc } from '@/docs/doc-management';
import { AppWrapper } from '@/tests/utils';

import { DraggableDocGridItem } from '../DocGridContentList';

vi.mock('../DocsGridItem', () => ({
  DocsGridItem: () => <div data-testid="docs-grid-item" />,
}));

const mockUpdateCanDrop = vi.fn();

vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual('@dnd-kit/core');
  return {
    ...actual,
    useDroppable: vi.fn(),
  };
});

const mockDoc: Doc = {
  id: 'doc-1',
  title: 'Test doc',
  abilities: {
    move: true,
    partial_update: false,
  },
  updated_at: new Date().toISOString(),
  nb_accesses_direct: 1,
} as unknown as Doc;

const renderItem = (selectedDocId?: string) =>
  render(
    <DraggableDocGridItem
      doc={mockDoc}
      dragMode={true}
      canDrag={true}
      updateCanDrop={mockUpdateCanDrop}
      disabled={false}
      selectedDocId={selectedDocId}
    />,
    { wrapper: AppWrapper },
  );

describe('DraggableDocGridItem', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    const { useDroppable } = await import('@dnd-kit/core');
    vi.mocked(useDroppable).mockReturnValue({
      isOver: true,
      setNodeRef: vi.fn(),
      over: null,
      active: null,
      rect: { current: null },
      node: { current: null },
    });
  });

  describe('updateCanDrop', () => {
    it('is called when hovering over a different document', async () => {
      const { waitFor } = await import('@testing-library/react');

      renderItem('other-doc-id');

      await waitFor(() => {
        expect(mockUpdateCanDrop).toHaveBeenCalledWith(true, true);
      });
    });

    it('is not called when hovering over the document being dragged (self-drop)', () => {
      renderItem(mockDoc.id);

      expect(mockUpdateCanDrop).not.toHaveBeenCalled();
    });
  });
});
