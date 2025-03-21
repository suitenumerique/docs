/* eslint-disable react-hooks/exhaustive-deps */
import { Data, useDroppable } from '@dnd-kit/core';
import { useEffect } from 'react';
import { css } from 'styled-components';

import { Box } from '@/components';
import { Doc } from '@/features/docs/doc-management';

type DroppableProps = {
  id: string;
  onOver?: (isOver: boolean, data?: Data<Doc>) => void;
  data?: Data<Doc>;
  children: React.ReactNode;
  enabledDrop?: boolean;
  canDrop?: boolean;
};

export const Droppable = (props: DroppableProps) => {
  const { isOver, setNodeRef } = useDroppable({
    id: props.id,
    data: props.data,
  });

  const enableHover = props.canDrop && isOver;

  useEffect(() => {
    props.onOver?.(isOver, props.data);
  }, [isOver, props.data, props.onOver]);

  return (
    <Box
      ref={setNodeRef}
      data-testid={`droppable-doc-${props.id}`}
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
    >
      {props.children}
    </Box>
  );
};
