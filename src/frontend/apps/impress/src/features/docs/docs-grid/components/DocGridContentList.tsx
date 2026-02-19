import { DndContext, DragOverlay, Modifier } from '@dnd-kit/core';
import { getEventCoordinates } from '@dnd-kit/utilities';
import { useModal } from '@gouvfr-lasuite/cunningham-react';
import { TreeViewMoveModeEnum } from '@gouvfr-lasuite/ui-kit';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { AlertModal, Card, Text } from '@/components';
import { Doc, KEY_LIST_DOC, useTrans } from '@/docs/doc-management';
import {
  getDocAccesses,
  getDocInvitations,
  useDeleteDocAccess,
  useDeleteDocInvitation,
} from '@/docs/doc-share';
import { useMoveDoc } from '@/docs/doc-tree';
import { useResponsiveStore } from '@/stores/useResponsiveStore';

import { DocDragEndData, useDragAndDrop } from '../hooks/useDragAndDrop';

import { DocsGridItem } from './DocsGridItem';
import { Draggable } from './Draggable';
import { Droppable } from './Droppable';

const snapToTopLeft: Modifier = ({
  activatorEvent,
  draggingNodeRect,
  transform,
}) => {
  if (draggingNodeRect && activatorEvent) {
    const activatorCoordinates = getEventCoordinates(activatorEvent);

    if (!activatorCoordinates) {
      return transform;
    }

    const offsetX = activatorCoordinates.x - draggingNodeRect.left;
    const offsetY = activatorCoordinates.y - draggingNodeRect.top;

    return {
      ...transform,
      x: transform.x + offsetX - 3,
      y: transform.y + offsetY - 3,
    };
  }

  return transform;
};

type DocGridContentListProps = {
  docs: Doc[];
};

export const DraggableDocGridContentList = ({
  docs,
}: DocGridContentListProps) => {
  const { mutateAsync: handleMove, isError } = useMoveDoc();
  const queryClient = useQueryClient();
  const modalConfirmation = useModal();
  const { mutate: handleDeleteInvitation } = useDeleteDocInvitation();
  const { mutate: handleDeleteAccess } = useDeleteDocAccess();
  const onDragData = useRef<DocDragEndData | null>(null);
  const { untitledDocument } = useTrans();

  const handleMoveDoc = async () => {
    if (!onDragData.current) {
      return;
    }

    const { sourceDocumentId, targetDocumentId } = onDragData.current;
    modalConfirmation.onClose();
    if (!sourceDocumentId || !targetDocumentId) {
      onDragData.current = null;

      return;
    }

    try {
      await handleMove({
        sourceDocumentId,
        targetDocumentId,
        position: TreeViewMoveModeEnum.FIRST_CHILD,
      });

      void queryClient.invalidateQueries({
        queryKey: [KEY_LIST_DOC],
      });
      const accesses = await getDocAccesses({
        docId: sourceDocumentId,
      });

      const invitationsResponse = await getDocInvitations({
        docId: sourceDocumentId,
        page: 1,
      });

      const invitations = invitationsResponse.results;

      await Promise.all([
        ...invitations.map((invitation) =>
          handleDeleteInvitation({
            docId: sourceDocumentId,
            invitationId: invitation.id,
          }),
        ),
        ...accesses.map((access) =>
          handleDeleteAccess({
            docId: sourceDocumentId,
            accessId: access.id,
          }),
        ),
      ]);
    } finally {
      onDragData.current = null;
    }
  };

  const onDrag = (data: DocDragEndData) => {
    onDragData.current = data;
    if (data.source.nb_accesses_direct <= 1) {
      void handleMoveDoc();
      return;
    }

    modalConfirmation.open();
  };

  const {
    selectedDoc,
    canDrag,
    canDrop,
    sensors,
    handleDragStart,
    handleDragEnd,
    updateCanDrop,
  } = useDragAndDrop(onDrag);

  const { t } = useTranslation();

  const overlayText = useMemo(() => {
    if (!canDrag) {
      return t('You must be the owner to move the document');
    }
    if (!canDrop) {
      return t('You must be at least the administrator of the target document');
    }

    return selectedDoc?.title || untitledDocument;
  }, [canDrag, canDrop, selectedDoc?.title, t, untitledDocument]);

  const cannotMoveDoc =
    !canDrag || (canDrop !== undefined && !canDrop) || isError;

  const [isDraggableDisabled, setIsDraggableDisabled] = useState(false);

  useEffect(() => {
    const checkModal = () => {
      const modalOpen = document.querySelector('[role="dialog"]');
      setIsDraggableDisabled(!!modalOpen);
    };

    checkModal();

    const observer = new MutationObserver(checkModal);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <DndContext
        sensors={sensors}
        modifiers={[snapToTopLeft]}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {docs.map((doc) => (
          <DraggableDocGridItem
            key={doc.id}
            doc={doc}
            dragMode={!!selectedDoc}
            canDrag={!!canDrag}
            updateCanDrop={updateCanDrop}
            disabled={isDraggableDisabled}
          />
        ))}
        <DragOverlay dropAnimation={null}>
          <Card
            $width="fit-content"
            $radius="12px"
            data-testid="drag-doc-overlay"
            role="alert"
            aria-label={t('Drag and drop status')}
            $theme={cannotMoveDoc ? 'error' : 'brand'}
            $variation="tertiary"
            $scope="semantic"
          >
            <Text $size="xs" $weight="500" $withThemeInherited>
              {overlayText}
            </Text>
          </Card>
        </DragOverlay>
      </DndContext>
      {modalConfirmation.isOpen && (
        <AlertModal
          {...modalConfirmation}
          title={t('Move document')}
          description={
            <Text $display="inline">
              <Trans
                i18nKey="By moving this document to <strong>{{targetDocumentTitle}}</strong>, it will lose its current access rights and inherit the permissions of that document. <strong>This access change cannot be undone.</strong>"
                values={{
                  targetDocumentTitle:
                    onDragData.current?.target.title ?? untitledDocument,
                }}
                components={{ strong: <strong /> }}
              />
            </Text>
          }
          confirmLabel={t('Move')}
          onConfirm={() => {
            void handleMoveDoc();
          }}
        />
      )}
    </>
  );
};

interface DraggableDocGridItemProps {
  disabled: boolean;
  doc: Doc;
  dragMode: boolean;
  canDrag: boolean;
  updateCanDrop: (canDrop: boolean, isOver: boolean) => void;
}

export const DraggableDocGridItem = ({
  disabled,
  doc,
  dragMode,
  canDrag,
  updateCanDrop,
}: DraggableDocGridItemProps) => {
  const canDrop = doc.abilities.move;

  return (
    <Droppable
      enabledDrop={canDrag}
      canDrop={canDrag && canDrop}
      onOver={(isOver) => updateCanDrop(canDrop, isOver)}
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
