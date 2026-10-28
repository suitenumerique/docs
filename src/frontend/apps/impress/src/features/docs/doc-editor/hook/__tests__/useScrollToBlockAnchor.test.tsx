import { act, renderHook } from '@testing-library/react';
import Router from 'next/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MAIN_LAYOUT_ID } from '@/layouts/conf';

import { useScrollToBlockAnchor } from '../useScrollToBlockAnchor';

describe('useScrollToBlockAnchor', () => {
  const scrollTo = vi.fn();
  const animate = vi.fn();
  let container: HTMLElement;
  let block: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();

    container = document.createElement('div');
    container.id = MAIN_LAYOUT_ID;
    container.scrollTo = scrollTo;
    block = document.createElement('div');
    block.id = 'block-1';
    block.animate = animate;
    container.appendChild(block);
    document.body.appendChild(container);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('scrolls smoothly during a hash change and highlights the block', () => {
    renderHook(() => useScrollToBlockAnchor());

    act(() => {
      Router.events.emit('hashChangeStart', '/docs/doc-id/#block-1');
    });

    expect(container.style.scrollBehavior).toBe('smooth');

    act(() => {
      Router.events.emit('hashChangeComplete', '/docs/doc-id/#block-1');
    });

    expect(animate).toHaveBeenCalledWith(
      { backgroundColor: expect.any(Array) },
      { duration: 1500, easing: 'ease-out' },
    );
    expect(scrollTo).not.toHaveBeenCalled();

    act(() => {
      vi.runAllTimers();
    });

    expect(container.style.scrollBehavior).toBe('');
  });

  it('scrolls to the top when the new URL has no hash', () => {
    renderHook(() => useScrollToBlockAnchor());

    act(() => {
      Router.events.emit('hashChangeStart', '/docs/doc-id/');
      Router.events.emit('hashChangeComplete', '/docs/doc-id/');
    });

    expect(container.style.scrollBehavior).toBe('smooth');
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
    expect(animate).not.toHaveBeenCalled();
  });

  it('stops listening to the hash changes once unmounted', () => {
    const { unmount } = renderHook(() => useScrollToBlockAnchor());

    unmount();
    Router.events.emit('hashChangeStart', '/docs/doc-id/');
    Router.events.emit('hashChangeComplete', '/docs/doc-id/');

    expect(container.style.scrollBehavior).toBe('');
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('removes the smooth scroll when unmounted during a hash change', () => {
    const { unmount } = renderHook(() => useScrollToBlockAnchor());

    Router.events.emit('hashChangeStart', '/docs/doc-id/#block-1');
    expect(container.style.scrollBehavior).toBe('smooth');

    unmount();

    expect(container.style.scrollBehavior).toBe('');
  });
});
