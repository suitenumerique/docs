import {
  FocusEvent,
  HTMLAttributes,
  KeyboardEvent,
  MouseEvent,
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
  /**
   * Rendered but not shown: only a focus that didn't come from the keyboard
   * keeps them, e.g. the options button the menu and its modals give the focus
   * back to when they close, after a click outside too. Unmounting them would
   * lose that focus; the first key press or hover shows them again.
   */
  areActionsTransparent: boolean;
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
      'onMouseEnter' | 'onMouseMove' | 'onMouseLeave' | 'onFocus' | 'onBlur'
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
  const [hasKeyboardFocus, setHasKeyboardFocus] = useState(false);

  const onMenuOpenChange = useCallback((isOpen: boolean) => {
    setIsMenuOpen(isOpen);
    // The menu and its modals cover the page, and React counts them as part
    // of this item: its `mouseleave` won't come (see `onPointerOver`). They
    // keep the actions shown meanwhile; the next real move brings it back.
    if (isOpen) {
      setIsPointerOver(false);
    }
  }, []);

  const handleActionsKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      // The focus left by a click becomes a keyboard focus, see
      // `areActionsTransparent`.
      setHasKeyboardFocus(true);

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

  const itemProps = useMemo(() => {
    /**
     * The menu is portalled, but React bubbles its mouse events through the
     * item that renders it: only the item's own DOM counts as being over it.
     */
    const onPointerOver = (event: MouseEvent<HTMLElement>) => {
      if (event.currentTarget.contains(event.target as Node)) {
        setIsPointerOver(true);
      }
    };

    return {
      onMouseEnter: onPointerOver,
      onMouseMove: onPointerOver,
      onMouseLeave: () => setIsPointerOver(false),
      onFocus: (event: FocusEvent<HTMLElement>) => {
        setHasFocusWithin(true);
        setHasKeyboardFocus(event.target.matches(':focus-visible'));
        onFocus?.();
      },
      onBlur: (event: FocusEvent<HTMLElement>) => {
        // Focus moving between the item and its own actions is not a blur.
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setHasFocusWithin(false);
          setHasKeyboardFocus(false);
        }
      },
    };
  }, [onFocus]);

  const isShown = isMobile || isMenuOpen || isPointerOver || isActive;

  return {
    areActionsVisible: isShown || hasFocusWithin,
    areActionsTransparent: !isShown && !hasKeyboardFocus,
    isMenuOpen,
    onMenuOpenChange,
    handleActionsKeyDown,
    itemProps,
  };
};
