import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BLOCK_HIGHLIGHT_CLASS,
  followDocLink,
  useScrollToBlockAnchor,
} from '../useScrollToBlockAnchor';

const { mockRouter } = vi.hoisted(() => {
  const listeners = new Map<string, (url: string) => void>();
  return {
    mockRouter: {
      asPath: '/docs/a1b2c3d4-e5f6-4789-a123-1234567890ab/',
      push: vi.fn(),
      listeners,
      events: {
        on: (name: string, fn: (url: string) => void) =>
          listeners.set(name, fn),
        off: (name: string) => listeners.delete(name),
      },
    },
  };
});

vi.mock('next/router', () => ({ default: mockRouter }));

const docId = 'a1b2c3d4-e5f6-4789-a123-1234567890ab';

const clickLink = (href: string, init: MouseEventInit = {}) => {
  const anchor = document.createElement('a');
  anchor.href = href;
  const text = document.createElement('span');
  anchor.appendChild(text);
  document.body.appendChild(anchor);

  const event = new MouseEvent('click', {
    button: 0,
    cancelable: true,
    bubbles: true,
    ...init,
  });
  Object.defineProperty(event, 'target', { value: text });

  return { handled: followDocLink(event), event };
};

describe('followDocLink', () => {
  beforeEach(() => {
    mockRouter.push.mockClear();
    document.body.innerHTML = '';
  });

  it('navigates in the same tab to a block of a document', () => {
    const { handled, event } = clickLink(
      `${window.location.origin}/docs/${docId}/#block-1`,
    );

    expect(handled).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    expect(mockRouter.push).toHaveBeenCalledWith(
      `/docs/${docId}/#block-1`,
      undefined,
      { scroll: false },
    );
  });

  it('navigates in the same tab to another document', () => {
    const otherId = 'b1b2c3d4-e5f6-4789-a123-1234567890ab';
    expect(clickLink(`/docs/${otherId}/`).handled).toBe(true);
    expect(mockRouter.push).toHaveBeenCalledWith(
      `/docs/${otherId}/`,
      undefined,
      { scroll: false },
    );
  });

  it('ignores external links, attachments and modified clicks', () => {
    expect(clickLink(`https://example.com/docs/${docId}/`).handled).toBe(false);
    expect(
      clickLink(`${window.location.origin}/media/${docId}/file.pdf`).handled,
    ).toBe(false);
    expect(clickLink(`/docs/${docId}/`, { metaKey: true }).handled).toBe(false);
    expect(clickLink(`/docs/${docId}/`, { ctrlKey: true }).handled).toBe(false);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});

describe('useScrollToBlockAnchor', () => {
  it('scrolls to and highlights the block when the hash changes', () => {
    vi.useFakeTimers();
    const blockEl = document.createElement('div');
    blockEl.id = 'block-1';
    const scrollIntoView = vi.fn();
    blockEl.scrollIntoView = scrollIntoView;
    document.body.appendChild(blockEl);

    renderHook(() => useScrollToBlockAnchor());

    act(() => {
      mockRouter.listeners.get('hashChangeComplete')?.(
        `/docs/${docId}/#block-1`,
      );
    });

    expect(scrollIntoView).toHaveBeenCalled();
    expect(blockEl.classList.contains(BLOCK_HIGHLIGHT_CLASS)).toBe(true);

    act(() => {
      vi.runAllTimers();
    });
    expect(blockEl.classList.contains(BLOCK_HIGHLIGHT_CLASS)).toBe(false);
    vi.useRealTimers();
  });
});
