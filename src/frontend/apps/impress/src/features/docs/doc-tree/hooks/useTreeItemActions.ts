import { KeyboardEvent, useCallback, useState } from 'react';

import { isWithinTreeItemActions } from '../utils';

type UseTreeItemActionsProps = {
  focusItem: () => void;
};

type UseTreeItemActionsReturn = {
  isMenuOpen: boolean;
  onMenuOpenChange: (isOpen: boolean) => void;
  /**
   * Keyboard access to the actions, to run first in the item's `onKeyDown`.
   * They form a single roving group — the emoji button then the toolbar
   * buttons, in DOM order:
   * - F2 enters the group / steps to the next button, wrapping;
   * - ArrowLeft / ArrowRight move within it once a button is focused;
   * - Escape leaves it for the item.
   *
   * Returns whether the event was handled, so the caller can stop there.
   */
  handleActionsKeyDown: (event: KeyboardEvent<HTMLElement>) => boolean;
};

/** Focusable action buttons inside `container`, in DOM order. */
const getActionButtons = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>('button')).filter(
    (button) =>
      !button.disabled && button.getAttribute('aria-disabled') !== 'true',
  );

/** Keyboard navigation inside a tree item's actions. */
export const useTreeItemActions = ({
  focusItem,
}: UseTreeItemActionsProps): UseTreeItemActionsReturn => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const onMenuOpenChange = useCallback((isOpen: boolean) => {
    setIsMenuOpen(isOpen);
  }, []);

  const handleActionsKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      // While the menu is open the keyboard belongs to it: Escape closes it and
      // React Aria restores the focus to the trigger from there.
      if (isMenuOpen) {
        return false;
      }

      const buttons = getActionButtons(event.currentTarget);
      const current = buttons.indexOf(
        document.activeElement as HTMLButtonElement,
      );

      // F2 enters the group (or steps forward once inside).
      if (event.key === 'F2' && buttons.length > 0) {
        event.preventDefault();
        // Keep the TreeView row from re-focusing the emoji button behind us.
        event.stopPropagation();
        buttons[(current + 1) % buttons.length].focus();
        return true;
      }

      // Arrows only rove once focus is already on one of the buttons, so that
      // an arrow on the bare tree item still reaches the tree's own handler.
      if (
        (event.key === 'ArrowRight' || event.key === 'ArrowLeft') &&
        current !== -1
      ) {
        event.preventDefault();
        event.stopPropagation();
        const delta = event.key === 'ArrowRight' ? 1 : -1;
        buttons[(current + delta + buttons.length) % buttons.length].focus();
        return true;
      }

      if (event.key === 'Escape' && isWithinTreeItemActions(event)) {
        event.preventDefault();
        event.stopPropagation();
        focusItem();
        return true;
      }

      return false;
    },
    [isMenuOpen, focusItem],
  );

  return {
    isMenuOpen,
    onMenuOpenChange,
    handleActionsKeyDown,
  };
};
