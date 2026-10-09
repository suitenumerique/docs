import { render, screen } from '@testing-library/react';
import type { Ref } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Doc } from '@/docs/doc-management';
import { useResponsiveStore } from '@/stores';
import { AppWrapper } from '@/tests/utils';

import { DocGridContentList } from '../DocGridContentList';

vi.mock('../DocsGridItem', () => ({
  DocsGridItem: ({
    doc,
    ref,
    dragMode: _dragMode,
    $css: _css,
    ...props
  }: {
    doc: Doc;
    ref?: Ref<HTMLDivElement>;
    dragMode?: boolean;
    $css?: unknown;
  }) => (
    <div ref={ref} {...props}>
      {doc.title}
    </div>
  ),
}));

const mockPointer = (isCoarse: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: query === '(pointer: coarse)' && isCoarse,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  });

  // AppWrapper does not mount the AppProvider that wires the store.
  return useResponsiveStore.getState().initializeResizeListener();
};

const doc = {
  id: 'doc-1',
  title: 'My doc',
  abilities: { move: true },
} as Doc;

describe('DocGridContentList', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    vi.restoreAllMocks();
  });

  it('lets a mouse drag a document whatever the viewport width', () => {
    cleanup = mockPointer(false);

    render(<DocGridContentList docs={[doc]} />, { wrapper: AppWrapper });

    expect(screen.getByText('My doc')).toHaveAttribute(
      'aria-roledescription',
      'draggable',
    );
  });

  it('does not make documents draggable with a coarse pointer', () => {
    cleanup = mockPointer(true);

    render(<DocGridContentList docs={[doc]} />, { wrapper: AppWrapper });

    expect(screen.getByText('My doc')).not.toHaveAttribute(
      'aria-roledescription',
    );
  });
});
