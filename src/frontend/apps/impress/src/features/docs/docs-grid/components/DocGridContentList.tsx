import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  Modifier,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { getEventCoordinates } from '@dnd-kit/utilities';
import { TreeViewMoveModeEnum } from '@gouvfr-lasuite/ui-kit';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Text } from '@/components';

import { Doc, KEY_LIST_DOC, Role } from '../../doc-management';
import { useMoveDoc } from '../../doc-tree/api/useMove';

import { DocsGridItem } from './DocsGridItem';
import { Draggable } from './dnd/Draggable';
import { Droppable } from './dnd/Droppable';

const activationConstraint = {
  distance: 20,
};

type DocGridContentListProps = {
  docs: Doc[];
};

export const DocGridContentList = ({ docs }: DocGridContentListProps) => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [selectedDoc, setSelectedDoc] = useState<Doc>();
  const canDrag = selectedDoc?.user_roles.some((role) => role === Role.OWNER);
  const [canDrop, setCanDrop] = useState<boolean>();
  const { mutate: handleMove } = useMoveDoc();

  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint,
  });

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint,
  });
  const keyboardSensor = useSensor(KeyboardSensor, {});

  const sensors = useSensors(mouseSensor, touchSensor, keyboardSensor);

  const handleDragStart = (e: DragStartEvent) => {
    document.body.style.cursor = 'grabbing';
    if (e.active.data.current) {
      setSelectedDoc(e.active.data.current as Doc);
    }
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setSelectedDoc(undefined);
    setCanDrop(undefined);
    document.body.style.cursor = 'default';
    if (!canDrag || !canDrop) {
      return;
    }

    const { active, over } = e;

    if (!over?.id || active.id === over?.id) {
      return;
    }

    handleMove(
      {
        sourceDocumentId: active.id as string,
        targetDocumentId: over.id as string,
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
  };

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
    return '#5858D3';
  }, [canDrag, canDrop]);

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
      {docs.map((doc) => {
        const canDropItem = doc.user_roles.some(
          (role) =>
            role === Role.ADMIN || role === Role.OWNER || role === Role.EDITOR,
        );
        return (
          <Droppable
            enabledDrop={canDrag}
            canDrop={canDrag && canDropItem}
            onOver={(isOver) => {
              if (isOver) {
                setCanDrop(canDropItem);
              }
            }}
            key={doc.id}
            id={doc.id}
            data={doc}
          >
            <Draggable key={doc.id} id={doc.id} data={doc}>
              <DocsGridItem dragMode={!!selectedDoc} doc={doc} key={doc.id} />
            </Draggable>
          </Droppable>
        );
      })}
      <DragOverlay dropAnimation={null}>
        <Box
          $width="fit-content"
          $padding={{ horizontal: 'xs', vertical: '3xs' }}
          $radius="12px"
          $background={overlayBgColor}
          data-testid="drag-doc-overlay"
          $height="auto"
        >
          <Text $size="xs" $variation="000" $weight="500">
            {overlayText}
          </Text>
        </Box>
      </DragOverlay>
    </DndContext>
  );
};

export const snapToTopLeft: Modifier = ({
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
