import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';

import { useOpenPresenterShortcut } from '../hooks/useOpenPresenterShortcut';
import { usePresenterStore } from '../stores';

const press = (init: KeyboardEventInit) => {
  const event = new KeyboardEvent('keydown', { ...init, cancelable: true });
  document.dispatchEvent(event);
  return event;
};

describe('useOpenPresenterShortcut', () => {
  afterEach(() => {
    usePresenterStore.setState({ isOpen: false, initialSlideIndex: 0 });
  });

  test('Ctrl+Alt+P opens the presenter on the first slide', () => {
    renderHook(() => useOpenPresenterShortcut(true));

    const event = press({ code: 'KeyP', ctrlKey: true, altKey: true });

    expect(usePresenterStore.getState().isOpen).toBe(true);
    expect(usePresenterStore.getState().initialSlideIndex).toBe(0);
    expect(event.defaultPrevented).toBe(true);
  });

  test('Cmd+Alt+P opens the presenter', () => {
    renderHook(() => useOpenPresenterShortcut(true));

    press({ code: 'KeyP', metaKey: true, altKey: true });

    expect(usePresenterStore.getState().isOpen).toBe(true);
  });

  test('leaves Ctrl+P to the browser', () => {
    renderHook(() => useOpenPresenterShortcut(true));

    const event = press({ code: 'KeyP', ctrlKey: true });

    expect(usePresenterStore.getState().isOpen).toBe(false);
    expect(event.defaultPrevented).toBe(false);
  });

  test('ignores the shortcut when Shift is held', () => {
    renderHook(() => useOpenPresenterShortcut(true));

    press({ code: 'KeyP', ctrlKey: true, altKey: true, shiftKey: true });

    expect(usePresenterStore.getState().isOpen).toBe(false);
  });

  test('does nothing when disabled', () => {
    renderHook(() => useOpenPresenterShortcut(false));

    press({ code: 'KeyP', ctrlKey: true, altKey: true });

    expect(usePresenterStore.getState().isOpen).toBe(false);
  });

  test('keeps the current slide when the presenter is already open', () => {
    usePresenterStore.setState({ isOpen: true, initialSlideIndex: 3 });
    renderHook(() => useOpenPresenterShortcut(true));

    press({ code: 'KeyP', ctrlKey: true, altKey: true });

    expect(usePresenterStore.getState().initialSlideIndex).toBe(3);
  });

  test('stops listening after unmount', () => {
    const { unmount } = renderHook(() => useOpenPresenterShortcut(true));

    unmount();
    press({ code: 'KeyP', ctrlKey: true, altKey: true });

    expect(usePresenterStore.getState().isOpen).toBe(false);
  });
});
