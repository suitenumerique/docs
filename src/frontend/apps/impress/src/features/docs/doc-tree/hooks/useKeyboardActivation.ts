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
