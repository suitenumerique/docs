import { renderHook } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { usePresenterToggleShortcut } from '../hooks/usePresenterToggleShortcut';

const renderShortcut = (enabled?: boolean) => {
  const onToggle = vi.fn();
  renderHook(() => usePresenterToggleShortcut(onToggle, enabled));
  return onToggle;
};

const press = (init: KeyboardEventInit) => {
  const event = new KeyboardEvent('keydown', { ...init, cancelable: true });
  window.dispatchEvent(event);
  return event;
};

describe('usePresenterToggleShortcut', () => {
  test('Ctrl+Alt+P and Meta+Alt+P call onToggle', () => {
    const onToggle = renderShortcut();
    press({ code: 'KeyP', ctrlKey: true, altKey: true });
    press({ code: 'KeyP', metaKey: true, altKey: true });
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  test('Mod+Alt+P prevents default', () => {
    renderShortcut();
    const event = press({ code: 'KeyP', ctrlKey: true, altKey: true });
    expect(event.defaultPrevented).toBe(true);
  });

  test('KeyP without the full modifier combination is ignored', () => {
    const onToggle = renderShortcut();
    press({ code: 'KeyP' });
    press({ code: 'KeyP', ctrlKey: true });
    press({ code: 'KeyP', altKey: true });
    press({ code: 'KeyP', ctrlKey: true, altKey: true, shiftKey: true });
    expect(onToggle).not.toHaveBeenCalled();
  });

  test('repeat events are ignored', () => {
    const onToggle = renderShortcut();
    press({ code: 'KeyP', ctrlKey: true, altKey: true, repeat: true });
    expect(onToggle).not.toHaveBeenCalled();
  });

  test('does nothing when disabled', () => {
    const onToggle = renderShortcut(false);
    press({ code: 'KeyP', ctrlKey: true, altKey: true });
    expect(onToggle).not.toHaveBeenCalled();
  });
});
