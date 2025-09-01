import { RefObject, useEffect } from 'react';

import { DropdownMenuOption } from '../DropdownMenu';

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
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) {
        return;
      }

      const enabledIndices = options
        .map((option, index) =>
          option.show !== false && !option.disabled ? index : -1,
        )
        .filter((index) => index !== -1);

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          const nextIndex =
            focusedIndex < enabledIndices.length - 1 ? focusedIndex + 1 : 0;
          const nextEnabledIndex = enabledIndices[nextIndex];
          setFocusedIndex(nextIndex);
          menuItemRefs.current[nextEnabledIndex]?.focus();
          break;

        case 'ArrowUp':
          event.preventDefault();
          const prevIndex =
            focusedIndex > 0 ? focusedIndex - 1 : enabledIndices.length - 1;
          const prevEnabledIndex = enabledIndices[prevIndex];
          setFocusedIndex(prevIndex);
          menuItemRefs.current[prevEnabledIndex]?.focus();
          break;

        case 'Enter':
        case ' ':
          event.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < enabledIndices.length) {
            const selectedOptionIndex = enabledIndices[focusedIndex];
            const selectedOption = options[selectedOptionIndex];
            if (selectedOption && selectedOption.callback) {
              onOpenChange(false);
              void selectedOption.callback();
            }
          }
          break;

        case 'Escape':
          event.preventDefault();
          onOpenChange(false);
          break;
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    isOpen,
    focusedIndex,
    options,
    menuItemRefs,
    setFocusedIndex,
    onOpenChange,
  ]);
};
