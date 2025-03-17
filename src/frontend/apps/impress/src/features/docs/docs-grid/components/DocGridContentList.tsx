import { DndContext, DragOverlay, Modifier } from '@dnd-kit/core';
import { getEventCoordinates } from '@dnd-kit/utilities';
import { TreeViewMoveModeEnum } from '@gouvfr-lasuite/ui-kit';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Text } from '@/components';
import { Doc, KEY_LIST_DOC, Role } from '@/docs/doc-management';
import { useMoveDoc } from '@/docs/doc-tree/api/useMove';

import { useDragAndDrop } from '../hooks/useDragAndDrop';

import { DocsGridItem } from './DocsGridItem';
import { Draggable } from './Draggable';
import { Droppable } from './Droppable';

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

export const DocGridContentList = ({ docs }: DocGridContentListProps) => {
  const { mutate: handleMove, isError } = useMoveDoc();
  const queryClient = useQueryClient();
  const onDrag = (sourceDocumentId: string, targetDocumentId: string) =>
    handleMove(
      {
        sourceDocumentId,
        targetDocumentId,
        position: TreeViewMoveModeEnum.FIRST_CHILD,
      },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({
            queryKey: [KEY_LIST_DOC],
          });
        },
      },
    );

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

  const overlayText = useMemo(() => {
    if (!canDrag) {
      return t('You must be the owner to move the document');
    }
    if (!canDrop) {
      return t('You must be at least the editor of the target document');
    }

    return selectedDoc?.title || t('Unnamed document');
  }, [canDrag, canDrop, selectedDoc, t]);

  const overlayBgColor = useMemo(() => {
    if (!canDrag) {
      return 'var(--c--theme--colors--danger-600)';
    }
    if (canDrop !== undefined && !canDrop) {
      return 'var(--c--theme--colors--danger-600)';
    }
    if (isError) {
      return 'var(--c--theme--colors--danger-600)';
    }

    return '#5858D3';
  }, [canDrag, canDrop, isError]);

  if (docs.length === 0) {
    return null;
  }

  return (
    <DndContext
      sensors={sensors}
      modifiers={[snapToTopLeft]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {docs.map((doc) => (
        <DraggableDocGridItem
          key={doc.id}
          doc={doc}
          dragMode={!!selectedDoc}
          canDrag={!!canDrag}
          updateCanDrop={updateCanDrop}
        />
      ))}
      <DragOverlay dropAnimation={null}>
        <Box
          $width="fit-content"
          $padding={{ horizontal: 'xs', vertical: '3xs' }}
          $radius="12px"
          $background={overlayBgColor}
          data-testid="drag-doc-overlay"
          $height="auto"
          role="alert"
        >
          <Text $size="xs" $variation="000" $weight="500">
            {overlayText}
          </Text>
        </Box>
      </DragOverlay>
    </DndContext>
  );
};

interface DocGridItemProps {
  doc: Doc;
  dragMode: boolean;
  canDrag: boolean;
  updateCanDrop: (canDrop: boolean, isOver: boolean) => void;
}

export const DraggableDocGridItem = ({
  doc,
  dragMode,
  canDrag,
  updateCanDrop,
}: DocGridItemProps) => {
  const canDropItem = doc.user_roles.some(
    (role) =>
      role === Role.ADMIN || role === Role.OWNER || role === Role.EDITOR,
  );

  return (
    <Droppable
      enabledDrop={canDrag}
      canDrop={canDrag && canDropItem}
      onOver={(isOver) => updateCanDrop(canDropItem, isOver)}
      id={doc.id}
      data={doc}
    >
      <Draggable id={doc.id} data={doc}>
        <DocsGridItem dragMode={dragMode} doc={doc} />
      </Draggable>
    </Droppable>
  );
};
