import { Data, useDraggable } from '@dnd-kit/core';
import { useEffect, useState } from 'react';

type DraggableProps<T> = {
  id: string;
  data?: Data<T>;
  children: React.ReactNode;
};

export const Draggable = <T,>(props: DraggableProps<T>) => {
  const [isDisabled, setIsDisabled] = useState(false);

  const { attributes, listeners, setNodeRef } = useDraggable({
    id: props.id,
    data: props.data,
    disabled: isDisabled,
  });

  useEffect(() => {
    const checkModal = () => {
      const modalOpen = document.querySelector('[role="dialog"]');
      setIsDisabled(!!modalOpen);
    };

    checkModal();

    const observer = new MutationObserver(checkModal);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  if (isDisabled) {
    return (
      <div
        data-testid={`draggable-doc-${props.id}`}
        className="--docs--grid-draggable --disabled"
        role="none"
        style={{ pointerEvents: 'none' }}
      >
        {props.children}
      </div>
    );
  }

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
