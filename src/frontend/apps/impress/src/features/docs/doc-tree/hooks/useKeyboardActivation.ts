import { useEffect } from 'react';

import { SELECTORS } from '../dom-selectors';

/**
 * Custom hook to activate an action with specific keyboard keys,
 * unless focus is inside actions toolbar or on an interactive element.
 */
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
      // Ignore if the focus is inside the actions toolbar or on an interactive element
      const target = e.target as HTMLElement | null;
      if (target) {
        const isInActions = target.closest(SELECTORS.ACTIONS_TOOLBAR);
        const isInteractive = target.closest(SELECTORS.INTERACTIVE_ELEMENTS);
        if (isInActions || isInteractive) {
          return;
        }
      }

      if (keys.includes(e.key)) {
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
