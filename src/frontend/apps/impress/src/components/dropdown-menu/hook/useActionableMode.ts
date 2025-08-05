import { TreeDataItem } from '@gouvfr-lasuite/ui-kit';
import { useEffect, useRef } from 'react';
import type { NodeRendererProps } from 'react-arborist';

type FocusableNode<T> = NodeRendererProps<TreeDataItem<T>>['node'] & {
  isFocused?: boolean;
  focus?: () => void;
};

/**
 * Hook to manage keyboard navigation for actionable items in a tree view.
 *
 * Provides two modes:
 * 1. Activation: F2/Enter moves focus to first actionable element
 * 2. Navigation: Arrow keys navigate between actions, Escape returns to tree node
 *
 * Disables navigation when dropdown menu is open to prevent conflicts.
 */
export const useActionableMode = <T>(
  node: FocusableNode<T>,
  isMenuOpen?: boolean,
) => {
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!node?.isFocused) {
      return;
    }

    const toActions = (e: KeyboardEvent) => {
      if (e.key === 'F2' || e.key === 'Enter') {
        const isAlreadyInActions = actionsRef.current?.contains(
          document.activeElement,
        );

        if (isAlreadyInActions) {
          return;
        }

        e.preventDefault();

        const focusables = actionsRef.current?.querySelectorAll<HTMLElement>(
          'button, [role="button"], a[href], input, [tabindex]:not([tabindex="-1"])',
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

    if (e.key === 'Escape') {
      e.stopPropagation();
      node?.focus?.();
    }

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();

      const focusables = actionsRef.current?.querySelectorAll<HTMLElement>(
        'button, [role="button"], a[href], input, [tabindex]:not([tabindex="-1"])',
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
