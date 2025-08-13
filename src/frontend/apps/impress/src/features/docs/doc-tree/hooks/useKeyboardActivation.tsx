import { useEffect } from 'react';

import { SELECTORS } from '../dom-selectors';

export const useKeyboardActivation = (
  keys: string[],
  enabled: boolean,
  action: () => void,
  capture = false,
) => {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const modal = document.querySelector(SELECTORS.MODAL_SCROLLER);

      if (modal) {
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      if (keys.includes(e.key)) {
        e.preventDefault();
        action();
      }
    };

    document.addEventListener('keydown', onKeyDown, capture);
    return () => document.removeEventListener('keydown', onKeyDown, capture);
  }, [keys, enabled, action, capture]);
};
