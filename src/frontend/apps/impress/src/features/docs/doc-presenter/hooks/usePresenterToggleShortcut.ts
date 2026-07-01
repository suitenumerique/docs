import { useEffect } from 'react';

/**
 * Toggles the presenter on Mod+Alt+P (Ctrl+Alt+P / ⌘⌥P).
 * Matching on `event.code` keeps the shortcut independent of the
 * keyboard layout, and requiring Ctrl/Meta makes it safe to fire
 * while typing in the editor.
 */
export const usePresenterToggleShortcut = (
  onToggle: () => void,
  enabled = true,
) => {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.code === 'KeyP' &&
        (event.ctrlKey || event.metaKey) &&
        event.altKey &&
        !event.shiftKey &&
        !event.repeat
      ) {
        event.preventDefault();
        onToggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onToggle, enabled]);
};
