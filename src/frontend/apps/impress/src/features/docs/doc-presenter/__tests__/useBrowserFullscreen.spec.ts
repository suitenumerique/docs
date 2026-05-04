import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { useBrowserFullscreen } from '../hooks/useBrowserFullscreen';

describe('useBrowserFullscreen', () => {
  let fullscreenElement: Element | null = null;
  const requestFullscreen = vi.fn(async () => {
    fullscreenElement = document.documentElement;
    document.dispatchEvent(new Event('fullscreenchange'));
  });
  const exitFullscreen = vi.fn(async () => {
    fullscreenElement = null;
    document.dispatchEvent(new Event('fullscreenchange'));
  });

  beforeEach(() => {
    fullscreenElement = null;
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElement,
    });
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen,
    });
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      value: exitFullscreen,
    });
    requestFullscreen.mockClear();
    exitFullscreen.mockClear();
  });

  afterEach(() => {
    fullscreenElement = null;
  });

  test('initial state reflects current fullscreen state', () => {
    const { result } = renderHook(() => useBrowserFullscreen());
    expect(result.current.isFullscreen).toBe(false);
  });

  test('enter() requests fullscreen and updates state', async () => {
    const { result } = renderHook(() => useBrowserFullscreen());
    await act(async () => {
      await result.current.enter();
    });
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(result.current.isFullscreen).toBe(true);
  });

  test('enter() is a no-op if already fullscreen', async () => {
    fullscreenElement = document.documentElement;
    const { result } = renderHook(() => useBrowserFullscreen());
    await act(async () => {
      await result.current.enter();
    });
    expect(requestFullscreen).not.toHaveBeenCalled();
  });

  test('exit() leaves fullscreen and updates state', async () => {
    const { result } = renderHook(() => useBrowserFullscreen());
    await act(async () => {
      await result.current.enter();
    });
    await act(async () => {
      await result.current.exit();
    });
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
    expect(result.current.isFullscreen).toBe(false);
  });

  test('toggle() flips state', async () => {
    const { result } = renderHook(() => useBrowserFullscreen());
    await act(async () => {
      await result.current.toggle();
    });
    expect(result.current.isFullscreen).toBe(true);
    await act(async () => {
      await result.current.toggle();
    });
    expect(result.current.isFullscreen).toBe(false);
  });

  test('reacts to external fullscreenchange events', () => {
    const { result } = renderHook(() => useBrowserFullscreen());
    act(() => {
      fullscreenElement = document.documentElement;
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    expect(result.current.isFullscreen).toBe(true);
  });

  test('exitIfOwned() exits when we initiated the fullscreen', async () => {
    const { result } = renderHook(() => useBrowserFullscreen());
    await act(async () => {
      await result.current.enter();
    });
    await act(async () => {
      await result.current.exitIfOwned();
    });
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
  });

  test('exitIfOwned() is a no-op when fullscreen pre-exists', async () => {
    fullscreenElement = document.documentElement;
    const { result } = renderHook(() => useBrowserFullscreen());
    await act(async () => {
      await result.current.exitIfOwned();
    });
    expect(exitFullscreen).not.toHaveBeenCalled();
  });

  test('exitIfOwned() is a no-op after user exits fullscreen externally', async () => {
    const { result } = renderHook(() => useBrowserFullscreen());
    await act(async () => {
      await result.current.enter();
    });
    // User presses Esc — fullscreen ends outside of our control.
    act(() => {
      fullscreenElement = null;
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    await act(async () => {
      await result.current.exitIfOwned();
    });
    expect(exitFullscreen).not.toHaveBeenCalled();
  });
});
