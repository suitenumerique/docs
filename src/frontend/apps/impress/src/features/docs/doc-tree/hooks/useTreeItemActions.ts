import {
  FocusEvent,
  HTMLAttributes,
  KeyboardEvent,
  useCallback,
  useMemo,
  useState,
} from 'react';

import { useResponsiveStore } from '@/stores';

import { isWithinTreeItemActions } from '../utils';

type UseTreeItemActionsProps = {
  isActive?: boolean;
  onFocus?: () => void;
  focusItem: () => void;
};

type UseTreeItemActionsReturn = {
  /** Whether `DocTreeItemActions` should be rendered for this item. */
  areActionsVisible: boolean;
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
  /** Spread on the element wrapping the item and its actions. */
  itemProps: Required<
    Pick<
      HTMLAttributes<HTMLElement>,
      'onMouseEnter' | 'onMouseLeave' | 'onFocus' | 'onBlur'
    >
  >;
};

/** Focusable action buttons inside `container`, in DOM order. */
const getActionButtons = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>('button')).filter(
    (button) =>
      !button.disabled && button.getAttribute('aria-disabled') !== 'true',
  );

/**
 * Drives how a tree item reveals its actions, across every input method:
 * pointer (hover), keyboard (focus, then F2 / arrows to step through them) and
 * touch (always visible, since there is no hover).
 *
 * Visibility is React state rather than `:hover` / `:focus-within` CSS, so the
 * actions — and the fairly heavy dropdown menu they mount — only exist for the
 * one item the user is interacting with instead of for every row in the tree.
 */
export const useTreeItemActions = ({
  isActive = false,
  onFocus,
  focusItem,
}: UseTreeItemActionsProps): UseTreeItemActionsReturn => {
  const { isMobile } = useResponsiveStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPointerOver, setIsPointerOver] = useState(false);
  const [hasFocusWithin, setHasFocusWithin] = useState(false);

  const onMenuOpenChange = useCallback((isOpen: boolean) => {
    setIsMenuOpen(isOpen);
  }, []);

  const handleActionsKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      // While the menu is open the keyboard belongs to it: Escape closes it and
      // `onMenuOpenChange` restores focus from there.
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

  const itemProps = useMemo(
    () => ({
      onMouseEnter: () => setIsPointerOver(true),
      onMouseLeave: () => setIsPointerOver(false),
      onFocus: () => {
        setHasFocusWithin(true);
        onFocus?.();
      },
      onBlur: (event: FocusEvent<HTMLElement>) => {
        // Focus moving between the item and its own actions is not a blur.
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setHasFocusWithin(false);
        }
      },
    }),
    [onFocus],
  );

  return {
    areActionsVisible:
      isMobile || isMenuOpen || isPointerOver || hasFocusWithin || isActive,
    isMenuOpen,
    onMenuOpenChange,
    handleActionsKeyDown,
    itemProps,
  };
};
