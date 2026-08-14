import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Doc } from '@/docs/doc-management';
import { AppWrapper } from '@/tests/utils';

import { LeftPanelFavoriteItem } from '../LeftPanelFavorites';

const mockUpdateCanDrop = vi.fn();

vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual('@dnd-kit/core');
  return {
    ...actual,
    useDroppable: vi.fn(),
  };
});

vi.mock('@/features/docs/DocDndContext', () => ({
  useDocDnd: vi.fn(),
}));

const mockDoc: Doc = {
  id: 'fav-doc-1',
  title: 'Pinned doc',
  abilities: {
    move: true,
    partial_update: false,
  },
  updated_at: new Date().toISOString(),
  nb_accesses_direct: 1,
} as unknown as Doc;

const renderItem = (doc = mockDoc) =>
  render(
    <ul>
      <LeftPanelFavoriteItem doc={doc} />
    </ul>,
    { wrapper: AppWrapper },
  );

describe('LeftPanelFavoriteItem', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    const { useDroppable } = await import('@dnd-kit/core');
    vi.mocked(useDroppable).mockReturnValue({
      isOver: false,
      setNodeRef: vi.fn(),
      over: null,
      active: null,
      rect: { current: null },
      node: { current: null },
    });

    const { useDocDnd } = await import('@/features/docs/DocDndContext');
    vi.mocked(useDocDnd).mockReturnValue({
      selectedDoc: undefined,
      canDrag: false,
      canDrop: undefined,
      updateCanDrop: mockUpdateCanDrop,
      isDraggableDisabled: false,
    });
  });

  it('renders the document title', () => {
    renderItem();
    expect(screen.getByText('Pinned doc')).toBeInTheDocument();
  });

  it('renders a link to the document', () => {
    renderItem();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/docs/fav-doc-1');
  });

  describe('updateCanDrop', () => {
    it('is called with true when the cursor is over a droppable-enabled favorite', async () => {
      const { useDroppable } = await import('@dnd-kit/core');
      vi.mocked(useDroppable).mockReturnValue({
        isOver: true,
        setNodeRef: vi.fn(),
        over: null,
        active: null,
        rect: { current: null },
        node: { current: null },
      });

      const { useDocDnd } = await import('@/features/docs/DocDndContext');
      vi.mocked(useDocDnd).mockReturnValue({
        selectedDoc: { id: 'dragging' } as Doc,
        canDrag: true,
        canDrop: undefined,
        updateCanDrop: mockUpdateCanDrop,
        isDraggableDisabled: false,
      });

      renderItem();

      await waitFor(() => {
        expect(mockUpdateCanDrop).toHaveBeenCalledWith(true, true);
      });
    });

    it('is not called when the cursor is not over the item', async () => {
      renderItem();
      expect(mockUpdateCanDrop).not.toHaveBeenCalled();
    });

    it('is not called when hovering over the document being dragged (self-drop)', async () => {
      const { useDroppable } = await import('@dnd-kit/core');
      vi.mocked(useDroppable).mockReturnValue({
        isOver: true,
        setNodeRef: vi.fn(),
        over: null,
        active: null,
        rect: { current: null },
        node: { current: null },
      });

      const { useDocDnd } = await import('@/features/docs/DocDndContext');
      vi.mocked(useDocDnd).mockReturnValue({
        selectedDoc: mockDoc,
        canDrag: true,
        canDrop: undefined,
        updateCanDrop: mockUpdateCanDrop,
        isDraggableDisabled: false,
      });

      renderItem();

      expect(mockUpdateCanDrop).not.toHaveBeenCalled();
    });

    it('is called with false when the favorite doc cannot be moved into', async () => {
      const { useDroppable } = await import('@dnd-kit/core');
      vi.mocked(useDroppable).mockReturnValue({
        isOver: true,
        setNodeRef: vi.fn(),
        over: null,
        active: null,
        rect: { current: null },
        node: { current: null },
      });

      const { useDocDnd } = await import('@/features/docs/DocDndContext');
      vi.mocked(useDocDnd).mockReturnValue({
        selectedDoc: { id: 'dragging' } as Doc,
        canDrag: true,
        canDrop: undefined,
        updateCanDrop: mockUpdateCanDrop,
        isDraggableDisabled: false,
      });

      const noMoveDoc = {
        ...mockDoc,
        abilities: { ...mockDoc.abilities, move: false },
      } as Doc;

      renderItem(noMoveDoc);

      await waitFor(() => {
        expect(mockUpdateCanDrop).toHaveBeenCalledWith(false, true);
      });
    });
  });

  describe('droppable registration', () => {
    it('registers with a favorite-prefixed ID to avoid collision with grid droppables', async () => {
      const { useDroppable } = await import('@dnd-kit/core');
      const mockUseDroppable = vi.mocked(useDroppable);
      mockUseDroppable.mockReturnValue({
        isOver: false,
        setNodeRef: vi.fn(),
        over: null,
        active: null,
        rect: { current: null },
        node: { current: null },
      });

      renderItem();

      expect(mockUseDroppable).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'favorite-fav-doc-1' }),
      );
    });

    it('passes the doc object as data so the move API receives the correct target', async () => {
      const { useDroppable } = await import('@dnd-kit/core');
      const mockUseDroppable = vi.mocked(useDroppable);
      mockUseDroppable.mockReturnValue({
        isOver: false,
        setNodeRef: vi.fn(),
        over: null,
        active: null,
        rect: { current: null },
        node: { current: null },
      });

      renderItem();

      expect(mockUseDroppable).toHaveBeenCalledWith(
        expect.objectContaining({ data: mockDoc }),
      );
    });
  });
});
