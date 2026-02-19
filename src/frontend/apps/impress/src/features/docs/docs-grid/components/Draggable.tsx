import { Data, useDraggable } from '@dnd-kit/core';
import { PropsWithChildren } from 'react';

type DraggableProps<T> = {
  id: string;
  data?: Data<T>;
  disabled?: boolean;
};

export const Draggable = <T,>(props: PropsWithChildren<DraggableProps<T>>) => {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: props.id,
    data: props.data,
    disabled: props.disabled,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-testid={`draggable-doc-${props.id}`}
      className="--docs--grid-draggable"
      role="none"
    >
      {props.children}
    </div>
  );
};
