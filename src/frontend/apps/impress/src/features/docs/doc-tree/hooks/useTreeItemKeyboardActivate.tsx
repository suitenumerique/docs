import { useEffect } from 'react';

/**
 * While the node has keyboard focus, run `activate()` on Enter / Space.
 * Gives tree-items the same "open on Enter" behaviour that clicks already have.
 */
export const useTreeItemKeyboardActivate = (
  focused: boolean,
  activate: () => void,
) => {
  useEffect(() => {
    if (!focused) {
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [focused, activate]);
};
