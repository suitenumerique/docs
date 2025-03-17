import { Data, useDroppable } from '@dnd-kit/core';
import { PropsWithChildren, useEffect } from 'react';
import { css } from 'styled-components';

import { Box } from '@/components';
import { Doc } from '@/docs/doc-management';

type DroppableProps = {
  id: string;
  onOver?: (isOver: boolean, data?: Data<Doc>) => void;
  data?: Data<Doc>;
  enabledDrop?: boolean;
  canDrop?: boolean;
};

export const Droppable = ({
  onOver,
  canDrop,
  data,
  children,
  id,
}: PropsWithChildren<DroppableProps>) => {
  const { isOver, setNodeRef } = useDroppable({
    id,
    data,
  });

  const enableHover = canDrop && isOver;

  useEffect(() => {
    onOver?.(isOver, data);
  }, [isOver, data, onOver]);

  return (
    <Box
      ref={setNodeRef}
      data-testid={`droppable-doc-${id}`}
      $css={css`
        border-radius: 4px;
        background-color: ${enableHover
          ? 'var(--c--theme--colors--primary-100)'
          : 'transparent'};
        border: 1.5px solid
          ${enableHover
            ? 'var(--c--theme--colors--primary-500)'
            : 'transparent'};
      `}
      className="--docs--grid-droppable"
    >
      {children}
    </Box>
  );
};
