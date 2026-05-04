import { renderHook } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { usePresenterShortcuts } from '../hooks/usePresenterShortcuts';

const renderShortcuts = (
  overrides: Partial<Parameters<typeof usePresenterShortcuts>[0]> = {},
) => {
  const handlers = {
    onPrev: vi.fn(),
    onNext: vi.fn(),
    onFirst: vi.fn(),
    onLast: vi.fn(),
    onToggleFullscreen: vi.fn(),
    onClose: vi.fn(),
    isFullscreen: false,
    ...overrides,
  };
  renderHook(() => usePresenterShortcuts(handlers));
  return handlers;
};

const press = (init: KeyboardEventInit) => {
  const event = new KeyboardEvent('keydown', { ...init, cancelable: true });
  window.dispatchEvent(event);
  return event;
};

describe('usePresenterShortcuts', () => {
  test('ArrowLeft and PageUp call onPrev', () => {
    const h = renderShortcuts();
    press({ code: 'ArrowLeft' });
    press({ code: 'PageUp' });
    expect(h.onPrev).toHaveBeenCalledTimes(2);
  });

  test('ArrowRight, PageDown and Space call onNext', () => {
    const h = renderShortcuts();
    press({ code: 'ArrowRight' });
    press({ code: 'PageDown' });
    press({ code: 'Space' });
    expect(h.onNext).toHaveBeenCalledTimes(3);
  });

  test('Home calls onFirst, End calls onLast', () => {
    const h = renderShortcuts();
    press({ code: 'Home' });
    press({ code: 'End' });
    expect(h.onFirst).toHaveBeenCalledTimes(1);
    expect(h.onLast).toHaveBeenCalledTimes(1);
  });

  test('KeyF toggles fullscreen but ignores modifiers', () => {
    const h = renderShortcuts();
    press({ code: 'KeyF' });
    press({ code: 'KeyF', metaKey: true });
    press({ code: 'KeyF', ctrlKey: true });
    expect(h.onToggleFullscreen).toHaveBeenCalledTimes(1);
  });

  test('Escape calls onClose only when not fullscreen', () => {
    const h1 = renderShortcuts({ isFullscreen: false });
    press({ code: 'Escape' });
    expect(h1.onClose).toHaveBeenCalledTimes(1);

    const h2 = renderShortcuts({ isFullscreen: true });
    press({ code: 'Escape' });
    expect(h2.onClose).not.toHaveBeenCalled();
  });

  test('Space prevents default to avoid page scroll', () => {
    renderShortcuts();
    const event = press({ code: 'Space' });
    expect(event.defaultPrevented).toBe(true);
  });

  test('Arrow keys prevent default', () => {
    renderShortcuts();
    expect(press({ code: 'ArrowLeft' }).defaultPrevented).toBe(true);
    expect(press({ code: 'ArrowRight' }).defaultPrevented).toBe(true);
  });

  test('non-arrow repeat events are ignored', () => {
    const h = renderShortcuts();
    press({ code: 'Space', repeat: true });
    expect(h.onNext).not.toHaveBeenCalled();
  });

  test('arrow repeat events are accepted', () => {
    const h = renderShortcuts();
    press({ code: 'ArrowRight', repeat: true });
    expect(h.onNext).toHaveBeenCalledTimes(1);
  });

  test('Space on a button is ignored to avoid native click double-trigger', () => {
    const h = renderShortcuts();
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.dispatchEvent(
      new KeyboardEvent('keydown', {
        code: 'Space',
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(h.onNext).not.toHaveBeenCalled();
    document.body.removeChild(button);
  });
});
