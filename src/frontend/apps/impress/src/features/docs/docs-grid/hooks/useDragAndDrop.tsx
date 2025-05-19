import {
  DragEndEvent,
  DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useState } from 'react';

import { Doc, Role } from '@/docs/doc-management';

const activationConstraint = {
  distance: 20,
};

export function useDragAndDrop(
  onDrag: (sourceDocumentId: string, targetDocumentId: string) => void,
) {
  const [selectedDoc, setSelectedDoc] = useState<Doc>();
  const [canDrop, setCanDrop] = useState<boolean>();

  const canDrag = selectedDoc?.user_role === Role.OWNER;

  const mouseSensor = useSensor(MouseSensor, { activationConstraint });
  const touchSensor = useSensor(TouchSensor, { activationConstraint });
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

    onDrag(active.id as string, over.id as string);
  };

  const updateCanDrop = (docCanDrop: boolean, isOver: boolean) => {
    if (isOver) {
      setCanDrop(docCanDrop);
    }
  };

  return {
    selectedDoc,
    canDrag,
    canDrop,
    sensors,
    handleDragStart,
    handleDragEnd,
    updateCanDrop,
  };
}
