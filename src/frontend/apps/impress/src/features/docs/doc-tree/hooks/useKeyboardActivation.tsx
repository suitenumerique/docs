import { useEffect } from 'react';

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
      const modal = document.querySelector('.c__modal__scroller');

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
