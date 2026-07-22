import {
  DndContext,
  DragOverlay,
  Modifier,
  UniqueIdentifier,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import { getEventCoordinates } from '@dnd-kit/utilities';
import { useModal } from '@gouvfr-lasuite/cunningham-react';
import { TreeViewMoveModeEnum } from '@gouvfr-lasuite/ui-kit';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Card, Text } from '@/components';
import { Doc, useMoveDoc, useTrans } from '@/docs/doc-management';
import { useResponsiveStore } from '@/stores/useResponsiveStore';

import { DocDragEndData, useDragAndDrop } from '../hooks/useDragAndDrop';

import { DocsGridItem } from './DocsGridItem';

const ModalConfirmationMoveDoc = dynamic(
  () =>
    import('./ModalConfimationMoveDoc').then((mod) => ({
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

type DocGridContentListProps = {
  docs: Doc[];
};

export const DraggableDocGridContentList = ({
  docs,
}: DocGridContentListProps) => {
  const { mutateAsync: handleMove, isError } = useMoveDoc();
  const modalConfirmation = useModal();
  const onDragData = useRef<DocDragEndData | null>(null);
  const { untitledDocument } = useTrans();

  const handleMoveDoc = async () => {
    if (!onDragData.current) {
      return;
    }

    const { sourceDocumentId, targetDocumentId } = onDragData.current;
    modalConfirmation.onClose();
    if (!sourceDocumentId || !targetDocumentId) {
      onDragData.current = null;

      return;
    }

    try {
      await handleMove({
        sourceDocumentId,
        targetDocumentId,
        position: TreeViewMoveModeEnum.FIRST_CHILD,
      });
    } finally {
      onDragData.current = null;
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
    updateCanDrop,
  } = useDragAndDrop(onDrag);

  const { t } = useTranslation();

  const dndAccessibility = useMemo(
    () => ({
      container: document.body,
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
          return t('Dragging was cancelled. Document {{id}} was dropped.', {
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
    if (!canDrop) {
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
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <DndContext
        sensors={sensors}
        modifiers={[snapToTopLeft]}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        accessibility={dndAccessibility}
      >
        {docs.map((doc) => (
          <DraggableDocGridItem
            key={doc.id}
            doc={doc}
            dragMode={!!selectedDoc}
            canDrag={!!canDrag}
            updateCanDrop={updateCanDrop}
            disabled={isDraggableDisabled}
          />
        ))}
        {createPortal(
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
          </DragOverlay>,
          document.body,
        )}
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
    </>
  );
};

interface DraggableDocGridItemProps {
  disabled: boolean;
  doc: Doc;
  dragMode: boolean;
  canDrag: boolean;
  updateCanDrop: (canDrop: boolean, isOver: boolean) => void;
}

export const DraggableDocGridItem = ({
  disabled,
  doc,
  dragMode,
  canDrag,
  updateCanDrop,
}: DraggableDocGridItemProps) => {
  const docCanDrop = doc.abilities.move;
  const enableDrop = canDrag && docCanDrop;

  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: doc.id,
    data: doc,
  });
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
  } = useDraggable({ id: doc.id, data: doc, disabled });

  useEffect(() => {
    updateCanDrop(docCanDrop, isOver);
  }, [docCanDrop, isOver, updateCanDrop]);

  const setRef = useCallback(
    (node: HTMLElement | null) => {
      setDropRef(node);
      setDragRef(node);
    },
    [setDropRef, setDragRef],
  );

  const isDragTarget = enableDrop && isOver;

  return (
    <DocsGridItem
      ref={setRef}
      dragMode={dragMode}
      doc={doc}
      data-testid={`droppable-doc-${doc.id}`}
      $css={css`
        ${
          isDragTarget
            ? css`
                & > div {
                  background-color: var(--c--globals--colors--brand-100);
                  border: 1.5px solid var(--c--globals--colors--brand-500);
                  border-radius: var(--c--globals--spacings--st);
                }
              `
            : ''
        }
      `}
      {...listeners}
      {...attributes}
    />
  );
};

export const DocGridContentList = ({ docs }: DocGridContentListProps) => {
  const { isLargeScreen } = useResponsiveStore();

  if (docs.length === 0) {
    return null;
  }

  if (isLargeScreen) {
    return <DraggableDocGridContentList docs={docs} />;
  }

  // Render a non-draggable list for smaller screens
  return docs.map((doc) => (
    <DocsGridItem key={doc.id} dragMode={false} doc={doc} />
  ));
};
