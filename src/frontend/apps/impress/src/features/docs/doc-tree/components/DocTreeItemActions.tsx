import {
  DropdownMenu,
  DropdownMenuOption,
  useTreeContext,
} from '@gouvfr-lasuite/ui-kit';
import { useModal } from '@openfun/cunningham-react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon } from '@/components';
import {
  Doc,
  ModalRemoveDoc,
  Role,
  useCopyDocLink,
  useCreateChildDoc,
  useDuplicateDoc,
} from '@/docs/doc-management';
import { ButtonAddChildDoc } from '@/features/docs/doc-tree/components/ButtonAddChildDoc';
import { ButtonMoreOptions } from '@/features/docs/doc-tree/components/ButtonMoreOptions';
import { useDropdownFocusManagement } from '@/features/docs/doc-tree/hooks/useDropdownFocusManagement';

import { useDetachDoc } from '../api/useDetach';
import MoveDocIcon from '../assets/doc-extract-bold.svg';

type DocTreeItemActionsProps = {
  doc: Doc;
  isOpen?: boolean;
  isRoot?: boolean;
  onCreateSuccess?: (newDoc: Doc) => void;
  onOpenChange?: (isOpen: boolean) => void;
  parentId?: string | null;
  actionsRef?: React.RefObject<HTMLDivElement>;
  onKeyDownCapture?: (e: React.KeyboardEvent) => void;
};

export const DocTreeItemActions = ({
  doc,
  isOpen,
  isRoot = false,
  onCreateSuccess,
  onOpenChange,
  parentId,
  actionsRef,
  onKeyDownCapture,
}: DocTreeItemActionsProps) => {
  const router = useRouter();
  const { t } = useTranslation();
  const deleteModal = useModal();
  const copyLink = useCopyDocLink(doc.id);
  const { mutate: detachDoc } = useDetachDoc();
  const treeContext = useTreeContext<Doc | null>();
  const { mutate: duplicateDoc } = useDuplicateDoc({
    onSuccess: (duplicatedDoc) => {
      // Reset the tree context root will reset the full tree view.
      treeContext?.setRoot(null);
      void router.push(`/docs/${duplicatedDoc.id}`);
    },
  });

  const handleDetachDoc = () => {
    if (!treeContext?.root) {
      return;
    }

    detachDoc(
      { documentId: doc.id, rootId: treeContext.root.id },
      {
        onSuccess: () => {
          if (treeContext.root) {
            treeContext.treeData.setSelectedNode(treeContext.root);
            void router.push(`/docs/${treeContext.root.id}`).then(() => {
              setTimeout(() => {
                treeContext?.treeData.deleteNode(doc.id);
              }, 100);
            });
          }
        },
      },
    );
  };

  const options: DropdownMenuOption[] = [
    {
      label: t('Copy link'),
      icon: <Icon iconName="link" $size="24px" />,
      callback: copyLink,
    },
    ...(!isRoot
      ? [
          {
            label: t('Move to my docs'),
            isDisabled: doc.user_role !== Role.OWNER,
            icon: (
              <Box
                $css={css`
                  transform: scale(0.8);
                `}
              >
                <MoveDocIcon />
              </Box>
            ),
            callback: handleDetachDoc,
          },
        ]
      : []),
    {
      label: t('Duplicate'),
      icon: <Icon $variation="600" iconName="content_copy" />,
      isDisabled: !doc.abilities.duplicate,
      callback: () => {
        duplicateDoc({
          docId: doc.id,
          with_accesses: false,
          canSave: doc.abilities.partial_update,
        });
      },
    },
    {
      label: t('Delete'),
      isDisabled: !doc.abilities.destroy,
      icon: <Icon iconName="delete" $size="24px" />,
      callback: deleteModal.open,
    },
  ];

  const { mutate: createChildDoc } = useCreateChildDoc({
    onSuccess: (newDoc) => {
      onCreateSuccess?.(newDoc);
      void router.push(`/docs/${newDoc.id}`);
    },
  });

  const onSuccessDelete = () => {
    if (parentId) {
      void router.push(`/docs/${parentId}`).then(() => {
        setTimeout(() => {
          treeContext?.treeData.deleteNode(doc.id);
        }, 100);
      });
    } else if (doc.id === treeContext?.root?.id && !parentId) {
      void router.push(`/`);
    } else if (treeContext && treeContext.root) {
      void router.push(`/docs/${treeContext.root.id}`).then(() => {
        setTimeout(() => {
          treeContext?.treeData.deleteNode(doc.id);
        }, 100);
      });
    }
  };

  useDropdownFocusManagement({
    isOpen: !!isOpen,
    docId: doc.id,
    actionsRef,
  });

  return (
    <Box className="doc-tree-root-item-actions">
      <Box
        ref={actionsRef}
        tabIndex={-1}
        onKeyDownCapture={onKeyDownCapture}
        $direction="row"
        $align="center"
        className="--docs--doc-tree-item-actions"
        $gap="4px"
        $css={css`
          &:focus-within {
            opacity: 1;
            visibility: visible;
          }
          button:focus-visible,
          [role='button']:focus-visible {
            outline: 2px solid var(--c--theme--colors--primary-500);
            outline-offset: 2px;
            background-color: var(--c--theme--colors--greyscale-050);
            border-radius: 4px;
          }
          .icon-button:focus-visible {
            outline: 2px solid var(--c--theme--colors--primary-500);
            outline-offset: 2px;
            background-color: var(--c--theme--colors--greyscale-050);
            border-radius: 4px;
          }
        `}
      >
        <DropdownMenu
          options={options}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
        >
          <ButtonMoreOptions
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            title={doc.title}
          />
        </DropdownMenu>
        {doc.abilities.children_create && (
          <ButtonAddChildDoc
            onCreateChild={createChildDoc}
            parentId={doc.id}
            title={doc.title}
          />
        )}
      </Box>
      {deleteModal.isOpen && (
        <ModalRemoveDoc
          onClose={deleteModal.onClose}
          doc={doc}
          onSuccess={onSuccessDelete}
        />
      )}
    </Box>
  );
};
