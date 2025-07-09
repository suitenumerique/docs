import {
  DropdownMenu,
  DropdownMenuOption,
  useTreeContext,
} from '@gouvfr-lasuite/ui-kit';
import { useModal } from '@openfun/cunningham-react';
import { useRouter } from 'next/router';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, BoxButton, Icon } from '@/components';

import {
  Doc,
  ModalRemoveDoc,
  Role,
  useCopyDocLink,
} from '../../doc-management';
import { useCreateChildrenDoc } from '../api/useCreateChildren';
import { useDetachDoc } from '../api/useDetach';
import MoveDocIcon from '../assets/doc-extract-bold.svg';
import { useTreeUtils } from '../hooks';

type DocTreeItemActionsProps = {
  doc: Doc;
  parentId?: string | null;
  onCreateSuccess?: (newDoc: Doc) => void;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
};

export const DocTreeItemActions = ({
  doc,
  parentId,
  onCreateSuccess,
  isOpen,
  onOpenChange,
}: DocTreeItemActionsProps) => {
  const router = useRouter();
  const { t } = useTranslation();
  const deleteModal = useModal();

  const copyLink = useCopyDocLink(doc.id);
  const { isCurrentParent } = useTreeUtils(doc);
  const { mutate: detachDoc } = useDetachDoc();
  const treeContext = useTreeContext<Doc>();

  const handleDetachDoc = () => {
    if (!treeContext?.root) {
      return;
    }

    detachDoc(
      { documentId: doc.id, rootId: treeContext.root.id },
      {
        onSuccess: () => {
          treeContext.treeData.deleteNode(doc.id);
          if (treeContext.root) {
            treeContext.treeData.setSelectedNode(treeContext.root);
            void router.push(`/docs/${treeContext.root.id}`);
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
    ...(!isCurrentParent
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
      label: t('Delete'),
      isDisabled: !doc.abilities.destroy,
      icon: <Icon iconName="delete" $size="24px" />,
      callback: deleteModal.open,
    },
  ];

  const { mutate: createChildrenDoc } = useCreateChildrenDoc({
    onSuccess: (newDoc) => {
      onCreateSuccess?.(newDoc);
      void router.push(`/docs/${newDoc.id}`);
    },
  });

  const afterDelete = () => {
    if (parentId) {
      treeContext?.treeData.deleteNode(doc.id);
      void router.push(`/docs/${parentId}`);
    } else if (doc.id === treeContext?.root?.id && !parentId) {
      void router.push(`/docs/`);
    } else if (treeContext && treeContext.root) {
      treeContext?.treeData.deleteNode(doc.id);
      void router.push(`/docs/${treeContext.root.id}`);
    }
  };

  return (
    <Fragment>
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
            $theme="primary"
            $variation="600"
          />
        </DropdownMenu>
        {doc.abilities.children_create && (
          <BoxButton
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();

              createChildrenDoc({
                parentId: doc.id,
              });
            }}
            color="primary"
          >
            <Icon
              variant="filled"
              $variation="800"
              $theme="primary"
              iconName="add_box"
            />
          </BoxButton>
        )}
      </Box>
      {deleteModal.isOpen && (
        <ModalRemoveDoc
          onClose={deleteModal.onClose}
          doc={doc}
          afterDelete={afterDelete}
        />
      )}
    </Fragment>
  );
};
