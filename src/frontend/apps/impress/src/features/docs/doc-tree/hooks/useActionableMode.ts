import { useEffect, useRef } from 'react';

import { SELECTORS } from '../dom-selectors';

export type ActionableNodeLike = {
  isFocused?: boolean;
  focus?: () => void;
};

/**
 * Hook to manage keyboard navigation for actionable items in a tree view.
 *
 * Disables navigation when dropdown menu is open to prevent conflicts.
 */
export const useActionableMode = (
  node: ActionableNodeLike,
  isMenuOpen?: boolean,
) => {
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const modalOpen = document.querySelector(SELECTORS.MODAL);
    if (!node?.isFocused || modalOpen) {
      return;
    }

    const toActions = (e: KeyboardEvent) => {
      const modalOpen = document.querySelector(SELECTORS.MODAL);
      if (modalOpen) {
        return;
      }

      if (e.key === 'F2') {
        const isAlreadyInActions = actionsRef.current?.contains(
          document.activeElement,
        );

        if (isAlreadyInActions) {
          return;
        }

        e.preventDefault();

        const focusables = actionsRef.current?.querySelectorAll<HTMLElement>(
          SELECTORS.FOCUSABLE,
        );

        const first = focusables?.[0];

        first?.focus();
      }
    };

    document.addEventListener('keydown', toActions, true);

    return () => {
      document.removeEventListener('keydown', toActions, true);
    };
  }, [node?.isFocused]);

  const onKeyDownCapture = (e: React.KeyboardEvent) => {
    if (isMenuOpen) {
      return;
    }

    const modal = document.querySelector(SELECTORS.MODAL);
    if (modal) {
      return;
    }

    if (e.key === 'Escape') {
      e.stopPropagation();
      node?.focus?.();
    }

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();

      const focusables = actionsRef.current?.querySelectorAll<HTMLElement>(
        SELECTORS.FOCUSABLE,
      );

      if (!focusables || focusables.length === 0) {
        return;
      }

      const currentIndex = Array.from(focusables).findIndex(
        (el) => el === document.activeElement,
      );

      let nextIndex: number;
      if (e.key === 'ArrowLeft') {
        nextIndex = currentIndex > 0 ? currentIndex - 1 : focusables.length - 1;
      } else {
        nextIndex = currentIndex < focusables.length - 1 ? currentIndex + 1 : 0;
      }

      focusables[nextIndex]?.focus();
    }
  };

  return { actionsRef, onKeyDownCapture };
};
