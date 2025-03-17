import { Data, useDraggable } from '@dnd-kit/core';

type DraggableProps<T> = {
  id: string;
  data?: Data<T>;
  children: React.ReactNode;
};

export const Draggable = <T,>(props: DraggableProps<T>) => {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: props.id,
    data: props.data,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-testid={`draggable-doc-${props.id}`}
      className="--docs--grid-draggable"
    >
      {props.children}
    </div>
  );
};
