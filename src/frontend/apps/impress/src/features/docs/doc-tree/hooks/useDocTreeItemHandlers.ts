import { useCallback } from 'react';

interface UseDocTreeItemHandlersProps {
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  createChildDoc: (params: { parentId: string }) => void;
  docId: string;
}

export const useDocTreeItemHandlers = ({
  isOpen,
  onOpenChange,
  createChildDoc,
  docId,
}: UseDocTreeItemHandlersProps) => {
  const preventDefaultAndStopPropagation = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      e.preventDefault();
    },
    [],
  );

  const isValidKeyEvent = useCallback((e: React.KeyboardEvent) => {
    return e.key === 'Enter' || e.key === ' ';
  }, []);

  const handleMoreOptionsClick = useCallback(
    (e: React.MouseEvent) => {
      preventDefaultAndStopPropagation(e);
      onOpenChange?.(!isOpen);
    },
    [isOpen, onOpenChange, preventDefaultAndStopPropagation],
  );

  const handleMoreOptionsKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isValidKeyEvent(e)) {
        preventDefaultAndStopPropagation(e);
        onOpenChange?.(!isOpen);
      }
    },
    [isOpen, onOpenChange, preventDefaultAndStopPropagation, isValidKeyEvent],
  );

  const handleAddChildClick = useCallback(
    (e: React.MouseEvent) => {
      preventDefaultAndStopPropagation(e);
      void createChildDoc({
        parentId: docId,
      });
    },
    [createChildDoc, docId, preventDefaultAndStopPropagation],
  );

  const handleAddChildKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isValidKeyEvent(e)) {
        preventDefaultAndStopPropagation(e);
        void createChildDoc({
          parentId: docId,
        });
      }
    },
    [createChildDoc, docId, preventDefaultAndStopPropagation, isValidKeyEvent],
  );

  return {
    handleMoreOptionsClick,
    handleMoreOptionsKeyDown,
    handleAddChildClick,
    handleAddChildKeyDown,
  };
};
