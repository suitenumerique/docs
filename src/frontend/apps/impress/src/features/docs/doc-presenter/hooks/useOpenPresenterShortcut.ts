import { useEffect } from 'react';

import { usePresenterStore } from '../stores';

/**
 * Binds Ctrl+Alt+P (Cmd+Alt+P on macOS) to open the current document in
 * presentation mode, saving a trip through the doc options menu.
 */
export const useOpenPresenterShortcut = (
  enabled: boolean,
  handleClose: () => void,
) => {
  const open = usePresenterStore((state) => state.open);
  const isOpen = usePresenterStore((state) => state.isOpen);

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
  }, [enabled, isOpen, open]);

  // Let users escape the boot cover if the editor never finishes loading.
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, handleClose]);
};
