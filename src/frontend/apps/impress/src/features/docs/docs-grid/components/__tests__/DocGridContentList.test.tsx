import { render, screen } from '@testing-library/react';
import type { Ref } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Doc } from '@/docs/doc-management';
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

const mockPointer = (isFine: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: query === '(any-pointer: fine)' && isFine,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  });
};

const doc = {
  id: 'doc-1',
  title: 'My doc',
  abilities: { move: true },
} as Doc;

describe('DocGridContentList', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lets a mouse drag a document whatever the viewport width', () => {
    mockPointer(true);

    render(<DocGridContentList docs={[doc]} />, { wrapper: AppWrapper });

    expect(screen.getByText('My doc')).toHaveAttribute(
      'aria-roledescription',
      'draggable',
    );
  });

  it('does not make documents draggable without a fine pointer', () => {
    mockPointer(false);

    render(<DocGridContentList docs={[doc]} />, { wrapper: AppWrapper });

    expect(screen.getByText('My doc')).not.toHaveAttribute(
      'aria-roledescription',
    );
  });
});
