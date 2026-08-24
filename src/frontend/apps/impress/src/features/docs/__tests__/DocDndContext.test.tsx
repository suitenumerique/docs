import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { DocDndProvider, useDocDnd } from '../DocDndContext';
import type { DocDragEndData } from '../docs-grid/hooks/useDragAndDrop';

// Capture the onDrag callback passed to useDragAndDrop so tests can trigger it directly
let capturedOnDrag: ((data: DocDragEndData) => void) | undefined;

vi.mock('@/features/docs/docs-grid/hooks/useDragAndDrop', () => ({
  useDragAndDrop: vi.fn((onDrag: (data: DocDragEndData) => void) => {
    capturedOnDrag = onDrag;
    return {
      selectedDoc: undefined,
      canDrag: false,
      canDrop: undefined,
      sensors: [],
      handleDragStart: vi.fn(),
      handleDragEnd: vi.fn(),
      updateCanDrop: vi.fn(),
    };
  }),
}));

// Replace next/dynamic with a transparent React.lazy wrapper so the modal renders in tests
vi.mock('next/dynamic', () => ({
  __esModule: true,
  default: (factory: () => Promise<{ default: React.ComponentType<any> }>) => {
    const Lazy = React.lazy(factory);
    return function DynamicWrapper(props: any) {
      return (
        <React.Suspense fallback={null}>
          <Lazy {...props} />
        </React.Suspense>
      );
    };
  },
}));

const sourceDoc = {
  id: 'source-id',
  title: 'Source doc',
  nb_accesses_direct: 1,
  user_role: 'owner',
} as any;

const targetDoc = {
  id: 'target-id',
  title: 'Target doc',
  abilities: { move: true },
} as any;

const dragData: DocDragEndData = {
  sourceDocumentId: 'source-id',
  targetDocumentId: 'target-id',
  source: sourceDoc,
  target: targetDoc,
};

// Consumer that exposes context value for assertions
const ContextConsumer = () => {
  const dnd = useDocDnd();
  return (
    <div
      data-testid="disabled"
      data-value={String(dnd?.isDraggableDisabled ?? false)}
    />
  );
};

const Wrapper = ({ children }: React.PropsWithChildren) => (
  <AppWrapper>
    <DocDndProvider>{children}</DocDndProvider>
  </AppWrapper>
);

describe('DocDndProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.restore();
    capturedOnDrag = undefined;
  });

  describe('isDraggableDisabled', () => {
    it('is false when no dialog is open', async () => {
      render(<ContextConsumer />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('disabled').dataset.value).toBe('false');
      });
    });

    it('is true when a dialog is added to the DOM', async () => {
      render(<ContextConsumer />, { wrapper: Wrapper });

      const dialog = document.createElement('div');
      dialog.setAttribute('role', 'dialog');
      document.body.appendChild(dialog);

      await waitFor(() => {
        expect(screen.getByTestId('disabled').dataset.value).toBe('true');
      });

      document.body.removeChild(dialog);

      await waitFor(() => {
        expect(screen.getByTestId('disabled').dataset.value).toBe('false');
      });
    });
  });

  describe('onDrag', () => {
    it('calls the move API immediately when the source doc has no shared access', async () => {
      fetchMock.post('http://test.jest/api/v1.0/documents/source-id/move/', {
        status: 200,
        body: JSON.stringify({}),
      });

      render(<ContextConsumer />, { wrapper: Wrapper });

      act(() => {
        capturedOnDrag?.({
          ...dragData,
          source: { ...sourceDoc, nb_accesses_direct: 1 },
        });
      });

      await waitFor(() => {
        expect(fetchMock.calls()).toHaveLength(1);
        expect(fetchMock.calls()[0][0]).toContain('documents/source-id/move/');
      });
    });

    it('does not call the move API immediately when the source doc is shared', async () => {
      fetchMock.post('http://test.jest/api/v1.0/documents/source-id/move/', {
        status: 200,
        body: JSON.stringify({}),
      });

      render(<ContextConsumer />, { wrapper: Wrapper });

      act(() => {
        capturedOnDrag?.({
          ...dragData,
          source: { ...sourceDoc, nb_accesses_direct: 3 },
        });
      });

      // The modal appearing proves the drag handler ran to completion — if the
      // API were going to be called immediately, it would have happened before this.
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      expect(fetchMock.calls()).toHaveLength(0);
    });

    it('shows the confirmation modal when the source doc is shared', async () => {
      render(<div />, { wrapper: Wrapper });

      act(() => {
        capturedOnDrag?.({
          ...dragData,
          source: { ...sourceDoc, nb_accesses_direct: 3 },
        });
      });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('calls the move API after confirming the modal', async () => {
      fetchMock.post('http://test.jest/api/v1.0/documents/source-id/move/', {
        status: 200,
        body: JSON.stringify({}),
      });

      render(<div />, { wrapper: Wrapper });

      act(() => {
        capturedOnDrag?.({
          ...dragData,
          source: { ...sourceDoc, nb_accesses_direct: 3 },
        });
      });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /^Move$/i }));

      await waitFor(() => {
        expect(fetchMock.calls()).toHaveLength(1);
        expect(fetchMock.calls()[0][0]).toContain('documents/source-id/move/');
      });
    });

    it('does not call the move API when cancelling the modal', async () => {
      fetchMock.post('http://test.jest/api/v1.0/documents/source-id/move/', {
        status: 200,
        body: JSON.stringify({}),
      });

      render(<div />, { wrapper: Wrapper });

      act(() => {
        capturedOnDrag?.({
          ...dragData,
          source: { ...sourceDoc, nb_accesses_direct: 3 },
        });
      });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /Cancel/i }));

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(fetchMock.calls()).toHaveLength(0);
    });

    it('does not call the move API when source and target are the same document', async () => {
      fetchMock.post('http://test.jest/api/v1.0/documents/source-id/move/', {
        status: 200,
        body: JSON.stringify({}),
      });

      render(<ContextConsumer />, { wrapper: Wrapper });

      act(() => {
        capturedOnDrag?.({
          ...dragData,
          sourceDocumentId: 'source-id',
          target: { ...targetDoc, id: 'source-id' },
          source: { ...sourceDoc, nb_accesses_direct: 1 },
        });
      });

      // The drop is rejected synchronously inside handleMoveDoc before any
      // async work, so there is nothing to wait for — check immediately.
      expect(fetchMock.calls()).toHaveLength(0);
    });

    it('strips the favorite- prefix before comparing source and target IDs', async () => {
      fetchMock.post('http://test.jest/api/v1.0/documents/source-id/move/', {
        status: 200,
        body: JSON.stringify({}),
      });

      render(<ContextConsumer />, { wrapper: Wrapper });

      // Artificially inject a favorite- prefix into target.id to exercise the
      // normalization branch. Without the replace(/^favorite-/, '') strip,
      // 'favorite-source-id' !== 'source-id' and the self-drop guard would
      // incorrectly allow the move to proceed.
      act(() => {
        capturedOnDrag?.({
          ...dragData,
          sourceDocumentId: 'source-id',
          target: { ...targetDoc, id: 'favorite-source-id' },
          source: { ...sourceDoc, nb_accesses_direct: 1 },
        });
      });

      expect(fetchMock.calls()).toHaveLength(0);
    });
  });
});
