import { Data, useDraggable } from '@dnd-kit/core';

type DraggableProps<T> = {
  id: string;
  data?: Data<T>;
  children: React.ReactNode;
};

export const Draggable = <T,>(props: DraggableProps<T>) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: props.id,
    data: props.data,
  });

  const style = {
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={{ ...style }} {...listeners} {...attributes}>
      {props.children}
    </div>
  );
};
