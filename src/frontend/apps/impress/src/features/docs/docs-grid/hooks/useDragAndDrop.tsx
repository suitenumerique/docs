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

export type DocDragEndData = {
  sourceDocumentId: string;
  targetDocumentId: string;
  source: Doc;
  target: Doc;
};

const activationConstraint = {
  distance: 20,
};

export function useDragAndDrop(onDrag: (data: DocDragEndData) => void) {
  const [selectedDoc, setSelectedDoc] = useState<Doc>();
  const [canDrop, setCanDrop] = useState<boolean>();

  const canDrag = selectedDoc?.user_role === Role.OWNER;

  const mouseSensor = useSensor(MouseSensor, { activationConstraint });
  const touchSensor = useSensor(TouchSensor, { activationConstraint });
  const keyboardSensor = useSensor(KeyboardSensor, {});
  const sensors = useSensors(mouseSensor, touchSensor, keyboardSensor);

  const handleDragStart = (e: DragStartEvent) => {
    document.body.style.cursor = 'grabbing';
    document.body.classList.add('is-dnd-dragging');
    if (e.active.data.current) {
      setSelectedDoc(e.active.data.current as Doc);
    }
  };

  const resetDrag = () => {
    setSelectedDoc(undefined);
    setCanDrop(undefined);
    document.body.style.cursor = 'default';
    document.body.classList.remove('is-dnd-dragging');
  };

  const handleDragCancel = () => {
    resetDrag();
  };

  const handleDragEnd = (e: DragEndEvent) => {
    resetDrag();
    if (!canDrag || !canDrop) {
      return;
    }

    const { active, over } = e;

    if (!over?.id || active.id === over?.id) {
      return;
    }

    onDrag({
      sourceDocumentId: active.id as string,
      targetDocumentId: over.id as string,
      source: active.data.current as Doc,
      target: over.data.current as Doc,
    });
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
    handleDragCancel,
    updateCanDrop,
  };
}
