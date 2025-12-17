import { useEffect } from 'react';

export const useKeyboardActivation = (
  keys: string[],
  enabled: boolean,
  action: () => void,
  capture = false,
  selector: string,
) => {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (keys.includes(e.key)) {
        // Ignore if focus is on interactive elements (emoji picker button, actions menu, etc.)
        const target = e.target as HTMLElement | null;
        if (
          target?.closest('.--docs--doc-icon') ||
          target?.closest('.light-doc-item-actions') ||
          target?.closest('button') ||
          target?.closest('[role="menu"]') ||
          target?.closest('[role="menuitem"]')
        ) {
          return;
        }

        e.preventDefault();
        action();
      }
    };
    const treeEl = document.querySelector<HTMLElement>(selector);
    if (!treeEl) {
      return;
    }
    treeEl.addEventListener('keydown', onKeyDown, capture);
    return () => {
      treeEl.removeEventListener('keydown', onKeyDown, capture);
    };
  }, [keys, enabled, action, capture, selector]);
};
