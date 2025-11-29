import {
  DropdownMenu,
  DropdownMenuOption,
  useTreeContext,
} from '@gouvfr-lasuite/ui-kit';
import { useModal } from '@openfun/cunningham-react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, BoxButton, Icon } from '@/components';
import {
  Doc,
  ModalRemoveDoc,
  Role,
  getEmojiAndTitle,
  useCopyDocLink,
  useCreateChildDoc,
  useDocTitleUpdate,
  useDuplicateDoc,
} from '@/docs/doc-management';

import { useDetachDoc } from '../api/useDetach';
import MoveDocIcon from '../assets/doc-extract-bold.svg';

type DocTreeItemActionsProps = {
  doc: Doc;
  isOpen?: boolean;
  isRoot?: boolean;
  onCreateSuccess?: (newDoc: Doc) => void;
  onOpenChange?: (isOpen: boolean) => void;
  parentId?: string | null;
};

export const DocTreeItemActions = ({
  doc,
  isOpen,
  isRoot = false,
  onCreateSuccess,
  onOpenChange,
  parentId,
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

  // Emoji Management
  const { emoji } = getEmojiAndTitle(doc.title ?? '');
  const { updateDocEmoji } = useDocTitleUpdate();
  const removeEmoji = () => {
    updateDocEmoji(doc.id, doc.title ?? '', '');
  };

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
          ...(emoji && doc.abilities.partial_update
            ? [
                {
                  label: t('Remove emoji'),
                  icon: <Icon iconName="emoji_emotions" $size="24px" />,
                  callback: removeEmoji,
                },
              ]
            : []),
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
      icon: <Icon iconName="content_copy" />,
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
    const isTopParent = doc.id === treeContext?.root?.id && !parentId;
    const parentIdComputed = parentId || treeContext?.root?.id;

    if (isTopParent) {
      void router.push(`/`);
    } else if (parentIdComputed) {
      void router.push(`/docs/${parentIdComputed}`).then(() => {
        setTimeout(() => {
          treeContext?.treeData.deleteNode(doc.id);
        }, 100);
      });
    }
  };

  return (
    <Box className="doc-tree-root-item-actions">
      <Box
        $direction="row"
        $align="center"
        className="--docs--doc-tree-item-actions"
        $gap="4px"
      >
        <DropdownMenu
          options={options}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
        >
          <Icon
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onOpenChange?.(!isOpen);
            }}
            iconName="more_horiz"
            variant="filled"
            $theme="brand"
            $variation="secondary"
            aria-label={t('More options')}
          />
        </DropdownMenu>
        {doc.abilities.children_create && (
          <BoxButton
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();

              createChildDoc({
                parentId: doc.id,
              });
            }}
            $theme="brand"
            $variation="secondary"
            aria-label={t('Add a sub page')}
            data-testid="doc-tree-item-actions-add-child"
          >
            <Icon variant="filled" $color="inherit" iconName="add_box" />
          </BoxButton>
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
