import { DropdownMenu, DropdownMenuOption } from '@gouvfr-lasuite/ui-kit';
import { useModal } from '@openfun/cunningham-react';
import { useRouter } from 'next/navigation';
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, BoxButton, Icon } from '@/components';
import { useLeftPanelStore } from '@/features/left-panel';

import { Doc, ModalRemoveDoc } from '../../doc-management';
import { useCreateChildrenDoc } from '../api/useCreateChildren';
import { useDocTreeData } from '../context/DocTreeContext';

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

  const treeData = useDocTreeData();
  const options: DropdownMenuOption[] = [
    {
      label: t('Delete'),
      icon: <Icon iconName="delete" />,
      callback: deleteModal.open,
    },
  ];

  const { mutate: createChildrenDoc } = useCreateChildrenDoc({
    onSuccess: (doc) => {
      onCreateSuccess?.(doc);

      togglePanel();
      treeData?.tree.setSelectedNode(doc);
    },
  });

  const afterDelete = () => {
    if (parentId) {
      router.push(`/docs/${parentId}`);
      treeData?.tree.selectNodeById(parentId);
      treeData?.tree.deleteNode(doc.id);
      void treeData?.tree.refreshNode(parentId);
    } else if (doc.id === treeData?.root?.id && !parentId) {
      router.push(`/docs/`);
    } else if (treeData && treeData.root) {
      router.push(`/docs/${treeData.root.id}`);
      treeData?.tree.deleteNode(doc.id);
      treeData?.tree.setSelectedNode(treeData.root);
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
            isFilled
            $theme="primary"
            $variation="600"
          />
        </DropdownMenu>
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
          <Icon $variation="800" $theme="primary" isFilled iconName="add_box" />
        </BoxButton>
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
