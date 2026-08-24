import {
  DndContext,
  DragOverlay,
  Modifier,
  UniqueIdentifier,
} from '@dnd-kit/core';
import { getEventCoordinates } from '@dnd-kit/utilities';
import { useModal } from '@gouvfr-lasuite/cunningham-react';
import { TreeViewMoveModeEnum } from '@gouvfr-lasuite/ui-kit';
import dynamic from 'next/dynamic';
import {
  PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { Card, Text } from '@/components';
import { Doc, useMoveDoc, useTrans } from '@/docs/doc-management';

import { DocDragEndData, useDragAndDrop } from './docs-grid/hooks/useDragAndDrop';

const ModalConfirmationMoveDoc = dynamic(
  () =>
    import('./docs-grid/components/ModalConfimationMoveDoc').then((mod) => ({
      default: mod.ModalConfirmationMoveDoc,
    })),
  { ssr: false },
);

const snapToTopLeft: Modifier = ({
  activatorEvent,
  draggingNodeRect,
  transform,
}) => {
  if (draggingNodeRect && activatorEvent) {
    const activatorCoordinates = getEventCoordinates(activatorEvent);
    if (!activatorCoordinates) {
      return transform;
    }
    const offsetX = activatorCoordinates.x - draggingNodeRect.left;
    const offsetY = activatorCoordinates.y - draggingNodeRect.top;
    return {
      ...transform,
      x: transform.x + offsetX - 3,
      y: transform.y + offsetY - 3,
    };
  }
  return transform;
};

type DocDndContextValue = {
  selectedDoc: Doc | undefined;
  canDrag: boolean;
  canDrop: boolean | undefined;
  updateCanDrop: (canDrop: boolean, isOver: boolean) => void;
  isDraggableDisabled: boolean;
};

const DocDndCtx = createContext<DocDndContextValue | null>(null);

export const useDocDnd = () => useContext(DocDndCtx);

export const DocDndProvider = ({ children }: PropsWithChildren) => {
  const { mutateAsync: handleMove, isError } = useMoveDoc();
  const modalConfirmation = useModal();
  const onDragData = useRef<DocDragEndData | null>(null);
  const { untitledDocument } = useTrans();
  const { t } = useTranslation();

  const handleMoveDoc = async () => {
    if (!onDragData.current) {
      return;
    }
    const { sourceDocumentId, target } = onDragData.current;
    const targetDocumentId = target.id;
    // Strip the `favorite-` prefix that favorite droppables add to avoid
    // dnd-kit ID collisions, so we compare raw document IDs.
    const normalizedSourceId = sourceDocumentId.replace(/^favorite-/, '');
    const normalizedTargetId = targetDocumentId.replace(/^favorite-/, '');
    const dragSnapshot = onDragData.current;
    modalConfirmation.onClose();
    if (!normalizedSourceId || !normalizedTargetId || normalizedSourceId === normalizedTargetId) {
      onDragData.current = null;
      return;
    }
    try {
      await handleMove({
        sourceDocumentId: normalizedSourceId,
        targetDocumentId: normalizedTargetId,
        position: TreeViewMoveModeEnum.FIRST_CHILD,
      });
    } finally {
      // Only clear if no newer drag has been queued while the request was in-flight.
      if (onDragData.current === dragSnapshot) {
        onDragData.current = null;
      }
    }
  };

  const onDrag = (data: DocDragEndData) => {
    onDragData.current = data;
    if (data.source.nb_accesses_direct <= 1) {
      void handleMoveDoc();
      return;
    }
    modalConfirmation.open();
  };

  const {
    selectedDoc,
    canDrag,
    canDrop,
    sensors,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
    updateCanDrop,
  } = useDragAndDrop(onDrag);

  const dndAccessibility = useMemo(
    () => ({
      screenReaderInstructions: {
        draggable: t(
          'To pick up a draggable item, press space or enter. While dragging, use the arrow keys to move the item. Press space or enter again to drop the item in its new position, or press escape to cancel.',
        ),
      },
      announcements: {
        onDragStart({ active }: { active: { id: UniqueIdentifier } }) {
          return t('Picked up document {{id}}.', { id: active.id });
        },
        onDragOver({
          active,
          over,
        }: {
          active: { id: UniqueIdentifier };
          over: { id: UniqueIdentifier } | null;
        }) {
          if (over) {
            return t('Document {{activeId}} is over document {{overId}}.', {
              activeId: active.id,
              overId: over.id,
            });
          }
          return t('Document {{id}} is no longer over a droppable area.', {
            id: active.id,
          });
        },
        onDragEnd({
          active,
          over,
        }: {
          active: { id: UniqueIdentifier };
          over: { id: UniqueIdentifier } | null;
        }) {
          if (over) {
            return t(
              'Document {{activeId}} was dropped over document {{overId}}.',
              { activeId: active.id, overId: over.id },
            );
          }
          return t('Document {{id}} was dropped.', { id: active.id });
        },
        onDragCancel({ active }: { active: { id: UniqueIdentifier } }) {
          return t('Dragging was cancelled. Document {{id}} was returned to its original position.', {
            id: active.id,
          });
        },
      },
    }),
    [t],
  );

  const overlayText = useMemo(() => {
    if (!canDrag) {
      return t('You must be the owner to move the document');
    }
    if (canDrop === false) {
      return t('You must be at least the administrator of the target document');
    }
    return selectedDoc?.title || untitledDocument;
  }, [canDrag, canDrop, selectedDoc?.title, t, untitledDocument]);

  const cannotMoveDoc =
    !canDrag || (canDrop !== undefined && !canDrop) || isError;

  const [isDraggableDisabled, setIsDraggableDisabled] = useState(false);

  useEffect(() => {
    const checkModal = () => {
      const modalOpen = document.querySelector('[role="dialog"]');
      setIsDraggableDisabled(!!modalOpen);
    };
    checkModal();
    const observer = new MutationObserver(checkModal);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <DocDndCtx.Provider
      value={{ selectedDoc, canDrag, canDrop, updateCanDrop, isDraggableDisabled }}
    >
      <DndContext
        sensors={sensors}
        modifiers={[snapToTopLeft]}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        accessibility={dndAccessibility}
      >
        {children}
        <DragOverlay dropAnimation={null}>
          <Card
            $width="fit-content"
            $radius="12px"
            data-testid="drag-doc-overlay"
            role="alert"
            aria-label={t('Drag and drop status')}
            $theme={cannotMoveDoc ? 'error' : 'brand'}
            $variation="tertiary"
            $scope="semantic"
          >
            <Text $size="xs" $weight="500" $withThemeInherited>
              {overlayText}
            </Text>
          </Card>
        </DragOverlay>
      </DndContext>
      {modalConfirmation.isOpen && (
        <ModalConfirmationMoveDoc
          isOpen={modalConfirmation.isOpen}
          onClose={modalConfirmation.onClose}
          onConfirm={handleMoveDoc}
          targetDocumentTitle={
            onDragData.current?.target.title || untitledDocument
          }
        />
      )}
    </DocDndCtx.Provider>
  );
};
