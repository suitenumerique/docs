import { act, renderHook } from '@testing-library/react';
import { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Doc, Role } from '@/docs/doc-management';
import { AppWrapper } from '@/tests/utils';

import { useDragAndDrop } from '../useDragAndDrop';

const mockDoc = {
  id: 'doc-1',
  user_role: Role.OWNER,
  nb_accesses_direct: 1,
  title: 'Test doc',
} as Doc;

const mockDragStartEvent = {
  active: {
    id: 'doc-1',
    data: { current: mockDoc },
    rect: { current: { initial: null, translated: null } },
  },
} as unknown as DragStartEvent;

const mockDragEndEvent = {
  active: {
    id: 'doc-1',
    data: { current: mockDoc },
    rect: { current: { initial: null, translated: null } },
  },
  over: null,
  delta: { x: 0, y: 0 },
  activatorEvent: null,
  collisions: null,
} as unknown as DragEndEvent;

describe('useDragAndDrop', () => {
  beforeEach(() => {
    document.body.classList.remove('is-dnd-dragging');
    document.body.style.cursor = '';
  });

  describe('is-dnd-dragging body class', () => {
    it('adds the class on drag start', () => {
      const { result } = renderHook(() => useDragAndDrop(vi.fn()), {
        wrapper: AppWrapper,
      });

      act(() => {
        result.current.handleDragStart(mockDragStartEvent);
      });

      expect(document.body.classList.contains('is-dnd-dragging')).toBe(true);
    });

    it('removes the class on drag end', () => {
      const { result } = renderHook(() => useDragAndDrop(vi.fn()), {
        wrapper: AppWrapper,
      });

      act(() => {
        result.current.handleDragStart(mockDragStartEvent);
      });

      act(() => {
        result.current.handleDragEnd(mockDragEndEvent);
      });

      expect(document.body.classList.contains('is-dnd-dragging')).toBe(false);
    });

    it('removes the class on drag end even when no valid drop target was hovered', () => {
      // canDrop remains undefined (no droppable was hovered), but the class must still be removed
      const { result } = renderHook(() => useDragAndDrop(vi.fn()), {
        wrapper: AppWrapper,
      });

      act(() => {
        result.current.handleDragStart(mockDragStartEvent);
      });

      act(() => {
        result.current.handleDragEnd({ ...mockDragEndEvent, over: null });
      });

      expect(document.body.classList.contains('is-dnd-dragging')).toBe(false);
    });

    it('removes the class on drag cancel (Escape key)', () => {
      const { result } = renderHook(() => useDragAndDrop(vi.fn()), {
        wrapper: AppWrapper,
      });

      act(() => {
        result.current.handleDragStart(mockDragStartEvent);
      });

      act(() => {
        result.current.handleDragCancel();
      });

      expect(document.body.classList.contains('is-dnd-dragging')).toBe(false);
    });
  });
});
