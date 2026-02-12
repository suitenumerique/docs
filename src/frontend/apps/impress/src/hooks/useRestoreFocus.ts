import { RefObject, useCallback } from 'react';

type FocusTarget =
  | HTMLElement
  | null
  | undefined
  | RefObject<HTMLElement | null>;

export const useRestoreFocus = () => {
  return useCallback((target?: FocusTarget) => {
    const element =
      target && 'current' in target ? target.current : (target ?? null);

    if (!element) {
      return;
    }

    requestAnimationFrame(() => {
      element.focus();
    });
  }, []);
};
