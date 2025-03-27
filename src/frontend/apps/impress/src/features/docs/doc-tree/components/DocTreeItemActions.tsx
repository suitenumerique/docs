import {
  DropdownMenu,
  DropdownMenuOption,
  useTreeContext,
} from '@gouvfr-lasuite/ui-kit';
import { useModal } from '@openfun/cunningham-react';
import { useRouter } from 'next/navigation';
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, BoxButton, Icon, IconVariant } from '@/components';
import { useLeftPanelStore } from '@/features/left-panel';

import { Doc, ModalRemoveDoc, useCopyDocLink } from '../../doc-management';
import { useCreateChildrenDoc } from '../api/useCreateChildren';
import { useDetachDoc } from '../api/useDetach';
import MoveDocIcon from '../assets/doc-extract-bold.svg';
import { isOwnerOrAdmin } from '../utils';

type DocTreeItemActionsProps = {
  doc: Doc;
  parentId?: string | null;
  onCreateSuccess?: (newDoc: Doc) => void;
};

export const DocTreeItemActions = ({
  doc,
  parentId,
  onCreateSuccess,
}: DocTreeItemActionsProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const { t } = useTranslation();
  const deleteModal = useModal();
  const { togglePanel } = useLeftPanelStore();
  const copyLink = useCopyDocLink(doc.id);
  const canUpdate = isOwnerOrAdmin(doc);

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
            router.push(`/docs/${treeContext.root.id}`);
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
    {
      label: t('Convert to doc'),
      isDisabled: treeContext?.root?.id === doc.id || !canUpdate,
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
    {
      label: t('Delete'),
      isDisabled: !canUpdate,
      icon: <Icon iconName="delete" $size="24px" />,
      callback: deleteModal.open,
    },
  ];

  const { mutate: createChildrenDoc } = useCreateChildrenDoc({
    onSuccess: (doc) => {
      onCreateSuccess?.(doc);
      togglePanel();
      router.push(`/docs/${doc.id}`);
      treeContext?.treeData.setSelectedNode(doc);
    },
  });

  const afterDelete = () => {
    if (parentId) {
      router.push(`/docs/${parentId}`);
      treeContext?.treeData.selectNodeById(parentId);
      treeContext?.treeData.deleteNode(doc.id);
      void treeContext?.treeData.refreshNode(parentId);
    } else if (doc.id === treeContext?.root?.id && !parentId) {
      router.push(`/docs/`);
    } else if (treeContext && treeContext.root) {
      router.push(`/docs/${treeContext.root.id}`);
      treeContext?.treeData.deleteNode(doc.id);
      treeContext?.treeData.setSelectedNode(treeContext.root);
    }
  };

  return (
    <Fragment>
      <Box
        $direction="row"
        $align="center"
        className={` ${isOpen ? 'isOpen' : ''}`}
        $css={css`
          gap: var(--c--theme----c--theme--spacings--xs);
        `}
      >
        <DropdownMenu
          options={options}
          isOpen={isOpen}
          onOpenChange={setIsOpen}
        >
          <Icon
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setIsOpen(!isOpen);
            }}
            iconName="more_horiz"
            variant={IconVariant.Filled}
            $theme="primary"
            $variation="600"
          />
        </DropdownMenu>
        {canUpdate && (
          <BoxButton
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();

              createChildrenDoc({
                title: t('Untitled page'),
                parentId: doc.id,
              });
            }}
            color="primary"
          >
            <Icon
              variant={IconVariant.Filled}
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
