import { act, fireEvent, renderHook } from '@testing-library/react';
import Router from 'next/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DocsBlockNoteEditor } from '@/docs/doc-editor/types';
import { MAIN_LAYOUT_ID } from '@/layouts/conf';

import {
  scrollBlockIntoView,
  useScrollToBlockAnchor,
} from '../useScrollToBlockAnchor';

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

    // Lasts 1 second: held half of it, then faded out
    expect(animate).toHaveBeenCalledWith(
      [
        expect.objectContaining({ offset: 0 }),
        expect.objectContaining({ offset: 0.5 }),
      ],
      { duration: 1000, easing: 'linear' },
    );
    expect(scrollTo).not.toHaveBeenCalled();

    act(() => {
      vi.runAllTimers();
    });

    expect(container.style.scrollBehavior).toBe('');
  });

  it('highlights the content of a block with a background color', () => {
    const content = document.createElement('div');
    content.className = 'bn-block-content';
    content.setAttribute('data-background-color', 'yellow');
    const contentAnimate = vi.fn();
    content.animate = contentAnimate;
    block.appendChild(content);
    renderHook(() => useScrollToBlockAnchor());

    act(() => {
      Router.events.emit('hashChangeComplete', '/docs/doc-id/#block-1');
    });

    expect(contentAnimate).toHaveBeenCalled();
    expect(animate).not.toHaveBeenCalled();
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

  it('removes the smooth scroll when the hash change is canceled', () => {
    renderHook(() => useScrollToBlockAnchor());

    act(() => {
      Router.events.emit('hashChangeStart', '/docs/doc-id/#block-1');
    });
    expect(container.style.scrollBehavior).toBe('smooth');

    act(() => {
      Router.events.emit('routeChangeError', new Error('cancelled'), '/x');
    });

    expect(container.style.scrollBehavior).toBe('');
  });

  describe('with a preference for reduced motion', () => {
    beforeEach(() => {
      vi.stubGlobal(
        'matchMedia',
        vi.fn().mockImplementation((query: string) => ({
          matches: query === '(prefers-reduced-motion: reduce)',
        })),
      );
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('does not scroll smoothly during a hash change', () => {
      renderHook(() => useScrollToBlockAnchor());

      act(() => {
        Router.events.emit('hashChangeStart', '/docs/doc-id/#block-1');
      });

      expect(container.style.scrollBehavior).toBe('');
    });

    it('jumps to the block instead of gliding', () => {
      block.getBoundingClientRect = () => ({ top: 500 }) as DOMRect;

      scrollBlockIntoView(block);

      expect(scrollTo).toHaveBeenCalledWith({ top: 450, behavior: 'auto' });
    });
  });

  it('glides to the block without a preference for reduced motion', () => {
    block.getBoundingClientRect = () => ({ top: 500 }) as DOMRect;

    scrollBlockIntoView(block);

    expect(scrollTo).toHaveBeenCalledWith({ top: 450, behavior: 'smooth' });
  });

  it('removes the smooth scroll when unmounted during a hash change', () => {
    const { unmount } = renderHook(() => useScrollToBlockAnchor());

    Router.events.emit('hashChangeStart', '/docs/doc-id/#block-1');
    expect(container.style.scrollBehavior).toBe('smooth');

    unmount();

    expect(container.style.scrollBehavior).toBe('');
  });

  describe('on a page opened on a block link', () => {
    let resize: () => void;
    let isObserving: boolean;
    // The media above the block load and push it down
    const pushBlockDown = () => {
      block.getBoundingClientRect = () => ({ top: 800 }) as DOMRect;
      resize();
    };
    const observe = vi.fn();
    const disconnect = vi.fn();

    beforeEach(() => {
      isObserving = false;
      vi.stubGlobal(
        'ResizeObserver',
        class {
          constructor(callback: ResizeObserverCallback) {
            // Like the real one: no callback once disconnected
            resize = () =>
              isObserving && callback([], this as unknown as ResizeObserver);
          }
          observe = (el: Element) => {
            isObserving = true;
            observe(el);
          };
          disconnect = () => {
            isObserving = false;
            disconnect();
          };
        },
      );

      // The block sits in a wrapper that grows when media above it load
      const wrapper = document.createElement('div');
      wrapper.appendChild(block);
      container.appendChild(wrapper);
      window.location.hash = 'block-1';
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      window.location.hash = '';
    });

    it('scrolls to the block and keeps it aligned while the content above resizes', () => {
      renderHook(() => useScrollToBlockAnchor());

      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(scrollTo).toHaveBeenLastCalledWith(
        expect.objectContaining({ behavior: 'smooth' }),
      );
      expect(animate).toHaveBeenCalled();
      expect(observe).toHaveBeenCalledWith(block.parentElement);
      expect(observe).not.toHaveBeenCalledWith(container);

      // The first callback, or a change below the block, does not move it:
      // the smooth scroll goes on
      resize();
      expect(scrollTo).toHaveBeenCalledTimes(1);

      pushBlockDown();
      expect(scrollTo).toHaveBeenCalledTimes(2);
      expect(scrollTo).toHaveBeenLastCalledWith({
        top: 750,
        behavior: 'auto',
      });
    });

    it('waits for the block to be rendered before scrolling to it', async () => {
      const wrapper = block.parentElement!;
      block.remove();
      renderHook(() => useScrollToBlockAnchor());

      expect(scrollTo).not.toHaveBeenCalled();

      await act(async () => {
        wrapper.appendChild(block);
        await Promise.resolve();
      });

      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(observe).toHaveBeenCalledWith(wrapper);
    });

    it('stops keeping the block aligned once the user scrolls', () => {
      renderHook(() => useScrollToBlockAnchor());

      fireEvent.wheel(window);
      pushBlockDown();

      expect(disconnect).toHaveBeenCalled();
      expect(scrollTo).toHaveBeenCalledTimes(1);
    });

    it('stops keeping the block aligned 15 seconds after the page opened', () => {
      renderHook(() => useScrollToBlockAnchor());

      act(() => {
        vi.advanceTimersByTime(14999);
      });
      expect(disconnect).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      pushBlockDown();

      expect(disconnect).toHaveBeenCalled();
      expect(scrollTo).toHaveBeenCalledTimes(1);
    });

    it('stops keeping the block aligned once unmounted', () => {
      const { unmount } = renderHook(() => useScrollToBlockAnchor());

      unmount();
      pushBlockDown();

      expect(disconnect).toHaveBeenCalled();
      expect(scrollTo).toHaveBeenCalledTimes(1);
    });
  });

  describe('focus after the activation of a link', () => {
    const setTextCursorPosition = vi.fn();
    const focus = vi.fn();
    const createEditor = (isEditable = true) =>
      ({
        isEditable,
        setTextCursorPosition,
        focus,
      }) as unknown as DocsBlockNoteEditor;

    const goToBlock = () =>
      act(() => {
        Router.events.emit('hashChangeStart', '/docs/doc-id/#block-1');
        Router.events.emit('hashChangeComplete', '/docs/doc-id/#block-1');
      });

    it('puts the caret in the block after Enter on the link', () => {
      const editor = createEditor();
      renderHook(() => useScrollToBlockAnchor(editor));

      fireEvent.keyDown(document.body, { key: 'Enter' });
      goToBlock();

      expect(setTextCursorPosition).toHaveBeenCalledWith('block-1', 'start');
      expect(focus).toHaveBeenCalled();
    });

    it('leaves the focus alone after a click on the link', () => {
      const editor = createEditor();
      renderHook(() => useScrollToBlockAnchor(editor));

      fireEvent.keyDown(document.body, { key: 'Enter' });
      fireEvent.pointerDown(document.body);
      goToBlock();

      expect(setTextCursorPosition).not.toHaveBeenCalled();
      expect(focus).not.toHaveBeenCalled();
    });

    it('moves the focus once per activation', () => {
      const editor = createEditor();
      renderHook(() => useScrollToBlockAnchor(editor));

      fireEvent.keyDown(document.body, { key: 'Enter' });
      goToBlock();
      goToBlock();

      expect(focus).toHaveBeenCalledTimes(1);
    });

    it('focuses the block itself in a read-only doc', () => {
      const editor = createEditor(false);
      renderHook(() => useScrollToBlockAnchor(editor));

      fireEvent.keyDown(document.body, { key: 'Enter' });
      goToBlock();

      expect(setTextCursorPosition).not.toHaveBeenCalled();
      expect(block).toHaveFocus();
    });

    it('focuses the block itself when it has no text to put a caret in', () => {
      const editor = createEditor();
      setTextCursorPosition.mockImplementation(() => {
        throw new Error('No content');
      });
      renderHook(() => useScrollToBlockAnchor(editor));

      fireEvent.keyDown(document.body, { key: 'Enter' });
      goToBlock();

      expect(block).toHaveFocus();
    });
  });
});
