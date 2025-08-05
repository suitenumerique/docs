import { useEffect } from 'react';

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
        ?.closest('.--docs--doc-tree-item-actions')
        ?.querySelector('[role="menu"]');

      if (menuElement) {
        const firstMenuItem = menuElement.querySelector<HTMLElement>(
          '[role="menuitem"], button, [tabindex]:not([tabindex="-1"])',
        );
        if (firstMenuItem) {
          firstMenuItem.focus();
          return;
        }
      }

      // Fallback: find any menu in document
      const allMenus = document.querySelectorAll('[role="menu"]');
      const lastMenu = allMenus[allMenus.length - 1];
      if (lastMenu) {
        const firstMenuItem = lastMenu.querySelector<HTMLElement>(
          '[role="menuitem"], button, [tabindex]:not([tabindex="-1"])',
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
      const modal = document.querySelector(
        '[role="dialog"], .c__modal, [data-modal], .c__modal__overlay, .ReactModal_Content',
      );
      if (modal) {
        return;
      }

      // Only handle focus return if no modal is open
      let subPageItem = actionsRef?.current?.closest('.--docs-sub-page-item');

      // If not found, try to find by data-testid
      if (!subPageItem) {
        const testIdElement = document.querySelector(
          `[data-testid="doc-sub-page-item-${docId}"]`,
        );
        subPageItem =
          testIdElement?.closest('.--docs-sub-page-item') ||
          testIdElement?.parentElement?.closest('.--docs-sub-page-item');
      }

      // Focus the sub-document if found
      if (subPageItem) {
        const focusableElement = subPageItem.querySelector<HTMLElement>(
          '[data-testid^="doc-sub-page-item-"]',
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
