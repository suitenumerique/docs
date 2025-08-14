import { RefObject, useEffect } from 'react';

import { DropdownMenuOption } from '@/components/DropdownMenu';

import { useKeyboardActivation } from '../features/docs/doc-tree/hooks/useKeyboardActivation';

type UseDropdownKeyboardNavProps = {
  isOpen: boolean;
  focusedIndex: number;
  options: DropdownMenuOption[];
  menuItemRefs: RefObject<(HTMLDivElement | null)[]>;
  setFocusedIndex: (index: number) => void;
  onOpenChange: (isOpen: boolean) => void;
};

export const useDropdownKeyboardNav = ({
  isOpen,
  focusedIndex,
  options,
  menuItemRefs,
  setFocusedIndex,
  onOpenChange,
}: UseDropdownKeyboardNavProps) => {
  useKeyboardActivation(['Enter', ' '], isOpen, () => {
    if (focusedIndex === -1) {
      return;
    }

    const enabledIndices = options
      .map((opt, i) => (opt.show !== false && !opt.disabled ? i : -1))
      .filter((i) => i !== -1);

    const selectedOpt = options[enabledIndices[focusedIndex]];
    if (selectedOpt?.callback) {
      onOpenChange(false);
      void selectedOpt.callback();
    }
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) {
        return;
      }

      const enabledIndices = options
        .map((opt, i) => (opt.show !== false && !opt.disabled ? i : -1))
        .filter((i) => i !== -1);

      switch (event.key) {
        case 'ArrowDown': {
          event.preventDefault();
          const nextIndex =
            focusedIndex < enabledIndices.length - 1 ? focusedIndex + 1 : 0;
          const nextEnabled = enabledIndices[nextIndex];
          setFocusedIndex(nextIndex);
          menuItemRefs.current[nextEnabled]?.focus();
          break;
        }

        case 'ArrowUp': {
          event.preventDefault();
          const prevIndex =
            focusedIndex > 0 ? focusedIndex - 1 : enabledIndices.length - 1;
          const prevEnabled = enabledIndices[prevIndex];
          setFocusedIndex(prevIndex);
          menuItemRefs.current[prevEnabled]?.focus();
          break;
        }

        case 'Escape': {
          event.preventDefault();
          onOpenChange(false);
          break;
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    focusedIndex,
    options,
    menuItemRefs,
    setFocusedIndex,
    onOpenChange,
  ]);
};
