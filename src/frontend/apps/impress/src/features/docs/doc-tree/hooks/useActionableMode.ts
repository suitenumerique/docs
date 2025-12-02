import { useEffect, useRef } from 'react';

import { SELECTORS } from '../dom-selectors';

export type ActionableNodeLike = {
  isFocused?: boolean;
  focus?: () => void;
};

export const useActionableMode = (
  node: ActionableNodeLike,
  isMenuOpen?: boolean,
) => {
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Handles F2 to focus the first actionable element in the actions area, except when a modal is open
    const toActions = (e: KeyboardEvent) => {
      if (e.key !== 'F2' || document.querySelector(SELECTORS.MODAL)) {
        return;
      }

      // Only react if the node is currently focused
      if (!node?.isFocused) {
        return;
      }

      const focusables = getFocusableElements();
      if (focusables.length === 0) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const first = focusables[0];
      // Ensure the element is focusable even if it's a <div> etc.
      if (
        first instanceof HTMLElement &&
        !first.hasAttribute('tabindex') &&
        first.tabIndex === -1
      ) {
        first.setAttribute('tabindex', '-1');
      }

      // TreeView may reclaim focus after this event cycle; setTimeout guarantees focus happens after
      setTimeout(() => {
        first.focus();
      }, 0);
    };

    document.addEventListener('keydown', toActions, true);
    return () => document.removeEventListener('keydown', toActions, true);
    // node is a dependency, as it's checked for focus state
  }, [node]);

  // Returns all focusable action elements (buttons or role="button") inside the actionsRef
  const getFocusableElements = () => {
    if (!actionsRef.current) {
      return [];
    }
    return Array.from(
      actionsRef.current.querySelectorAll<HTMLElement>(
        'button, [role="button"]',
      ),
    );
  };

  const onKeyDownCapture = (e: React.KeyboardEvent) => {
    // Do nothing if the menu is open or a modal is displayed
    if (isMenuOpen || document.querySelector(SELECTORS.MODAL)) {
      return;
    }

    // Escape: return focus to the tree node
    if (e.key === 'Escape') {
      e.stopPropagation();
      node?.focus?.();
    }
  };

  return { actionsRef, onKeyDownCapture };
};
