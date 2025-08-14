import { useEffect } from 'react';

import { SELECTORS } from '../dom-selectors';

interface UseDropdownFocusManagementProps {
  isOpen: boolean;
  docId: string;
  actionsRef?: React.RefObject<HTMLDivElement>;
}

export const useDropdownFocusManagement = ({
  isOpen,
  docId,
  actionsRef,
}: UseDropdownFocusManagementProps) => {
  // Focus management for dropdown menu opening
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timer = setTimeout(() => {
      // Try to find menu in actions container first
      const menuElement = actionsRef?.current
        ?.closest(SELECTORS.ACTIONS_CONTAINER)
        ?.querySelector(SELECTORS.ROLE_MENU);

      if (menuElement) {
        const firstMenuItem = menuElement.querySelector<HTMLElement>(
          SELECTORS.ROLE_MENUITEM_OR_BUTTON,
        );
        if (firstMenuItem) {
          firstMenuItem.focus();
          return;
        }
      }

      // Fallback: find any menu in document
      const allMenus = document.querySelectorAll(SELECTORS.ROLE_MENU);
      const lastMenu = allMenus[allMenus.length - 1];
      if (lastMenu) {
        const firstMenuItem = lastMenu.querySelector<HTMLElement>(
          SELECTORS.ROLE_MENUITEM_OR_BUTTON,
        );
        if (firstMenuItem) {
          firstMenuItem.focus();
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isOpen, actionsRef]);

  // Focus management for returning to sub-document when menu closes
  useEffect(() => {
    if (isOpen) {
      return;
    }

    const timer = setTimeout(() => {
      const modal = document.querySelector(SELECTORS.MODAL);
      if (modal) {
        return;
      }

      // Only handle focus return if no modal is open
      let subPageItem = actionsRef?.current?.closest(
        SELECTORS.DOC_SUB_PAGE_ITEM,
      );

      // If not found, try to find by data-testid
      if (!subPageItem) {
        const testIdElement = document.querySelector(
          `[data-testid="${SELECTORS.DATA_TESTID_DOC_SUB_PAGE_ITEM}${docId}"]`,
        );
        subPageItem =
          testIdElement?.closest(SELECTORS.DOC_SUB_PAGE_ITEM) ||
          testIdElement?.parentElement?.closest(SELECTORS.DOC_SUB_PAGE_ITEM);
      }

      // Focus the sub-document if found
      if (subPageItem) {
        const focusableElement = subPageItem.querySelector<HTMLElement>(
          SELECTORS.DATA_TESTID_DOC_SUB_PAGE_ITEM_PREFIX,
        );

        if (focusableElement) {
          focusableElement.focus();
        } else {
          (subPageItem as HTMLElement).focus();
        }
        return;
      }

      // Fallback: focus actions container
      actionsRef?.current?.focus();
    }, 100);

    return () => clearTimeout(timer);
  }, [isOpen, actionsRef, docId]);
};
