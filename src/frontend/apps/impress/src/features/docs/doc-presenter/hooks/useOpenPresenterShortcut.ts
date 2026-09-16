import { useEffect } from 'react';

import { usePresenterStore } from '../stores';

/**
 * Binds Ctrl+Alt+P (Cmd+Alt+P on macOS) to open the current document in
 * presentation mode, saving a trip through the doc options menu.
 */
export const useOpenPresenterShortcut = (enabled: boolean) => {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const isPresentShortcut =
        (event.ctrlKey || event.metaKey) &&
        event.altKey &&
        !event.shiftKey &&
        // On macOS, Alt+P types "π", so `event.key` cannot be used here.
        event.code === 'KeyP';

      if (!isPresentShortcut) {
        return;
      }

      event.preventDefault();

      const { isOpen, open } = usePresenterStore.getState();
      // Pressing the shortcut again while presenting must not jump back
      // to the first slide.
      if (!isOpen) {
        open(0);
      }
    };

    // Capture phase, so the editor's own key handlers cannot swallow it.
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabled]);
};
