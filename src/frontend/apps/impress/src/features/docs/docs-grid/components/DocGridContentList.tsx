import { Doc } from '@/docs/doc-management';
import { useResponsiveStore } from '@/stores/useResponsiveStore';

import { useDocDnd } from '@/features/docs/DocDndContext';

import { DocsGridItem } from './DocsGridItem';
import { Draggable } from './Draggable';
import { Droppable } from './Droppable';

type DocGridContentListProps = {
  docs: Doc[];
};

export const DraggableDocGridContentList = ({
  docs,
}: DocGridContentListProps) => {
  const dnd = useDocDnd();

  return (
    <>
      {docs.map((doc) => (
        <DraggableDocGridItem
          key={doc.id}
          doc={doc}
          dragMode={!!dnd?.selectedDoc}
          canDrag={dnd?.canDrag ?? false}
          updateCanDrop={dnd?.updateCanDrop ?? (() => {})}
          disabled={dnd?.isDraggableDisabled ?? false}
          selectedDocId={dnd?.selectedDoc?.id}
        />
      ))}
    </>
  );
};

interface DraggableDocGridItemProps {
  disabled: boolean;
  doc: Doc;
  dragMode: boolean;
  canDrag: boolean;
  updateCanDrop: (canDrop: boolean, isOver: boolean) => void;
  selectedDocId?: string;
}

export const DraggableDocGridItem = ({
  disabled,
  doc,
  dragMode,
  canDrag,
  updateCanDrop,
  selectedDocId,
}: DraggableDocGridItemProps) => {
  const isSelf = selectedDocId === doc.id;
  const canDrop = doc.abilities.move;

  return (
    <Droppable
      enabledDrop={canDrag}
      canDrop={canDrag && canDrop && !isSelf}
      onOver={(isOver) => {
        if (!isSelf) updateCanDrop(canDrop, isOver);
      }}
      id={doc.id}
      data={doc}
    >
      <Draggable id={doc.id} data={doc} disabled={disabled}>
        <DocsGridItem dragMode={dragMode} doc={doc} />
      </Draggable>
    </Droppable>
  );
};

export const DocGridContentList = ({ docs }: DocGridContentListProps) => {
  const { isDesktop } = useResponsiveStore();

  if (docs.length === 0) {
    return null;
  }

  if (isDesktop) {
    return <DraggableDocGridContentList docs={docs} />;
  }

  return docs.map((doc) => (
    <DocsGridItem dragMode={false} doc={doc} key={doc.id} />
  ));
};
