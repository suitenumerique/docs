import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { snapCenterToCursor } from '@dnd-kit/modifiers';
import { useState } from 'react';
import { css } from 'styled-components';

import { Box, Text } from '@/components';

import { Doc } from '../../doc-management';

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
  const [selectedDoc, setSelectedDoc] = useState<Doc>();
  console.log(selectedDoc);
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint,
  });

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint,
  });
  const keyboardSensor = useSensor(KeyboardSensor, {});

  const sensors = useSensors(mouseSensor, touchSensor, keyboardSensor);

  const handleDragStart = (e: DragStartEvent) => {
    console.log('drag start');
    console.log(e);
    if (e.active.data.current) {
      setSelectedDoc(e.active.data.current as Doc);
    }
  };

  if (docs.length === 0) {
    return null;
  }

  return (
    <DndContext
      sensors={sensors}
      modifiers={[snapCenterToCursor]}
      onDragStart={handleDragStart}
      onDragEnd={(e) => {
        console.log('drag end');
        console.log(e);
      }}
    >
      {docs.map((doc) => (
        <Droppable key={doc.id} id={doc.id} data={doc}>
          <Draggable key={doc.id} id={doc.id} data={doc}>
            <DocsGridItem doc={doc} key={doc.id} />
          </Draggable>
        </Droppable>
      ))}
      <DragOverlay>
        <Box
          $width="fit-content"
          $padding="2xs"
          $radius="8px"
          $height="auto"
          $css={css`
            cursor: grab;
            background: ${selectedDoc?.abilities.update
              ? 'var(--c--theme--colors--primary-300)'
              : 'var(--c--theme--colors--danger-600)'};
          `}
        >
          <Text $size="xs" $variation="600" $weight="500">
            {selectedDoc?.title}
          </Text>
        </Box>
      </DragOverlay>
    </DndContext>
  );
};
