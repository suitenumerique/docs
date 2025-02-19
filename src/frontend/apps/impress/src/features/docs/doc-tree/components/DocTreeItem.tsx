import { useModal } from '@openfun/cunningham-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { NodeRendererProps } from 'react-arborist';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { Box, BoxButton, DropdownMenu, Icon } from '@/components';
import { TreeViewNode } from '@/components/common/tree/TreeView';
import { useTreeStore } from '@/components/common/tree/treeStore';
import { useCunninghamTheme } from '@/cunningham';
import { useLeftPanelStore } from '@/features/left-panel';

import { ModalRemoveDoc } from '../../doc-management';
import { ModalRenameDoc } from '../../doc-management/components/ModalRenameDoc';
import { DocShareModal } from '../../doc-share';
import { LightDocItem } from '../../docs-grid/components/LightDocItem';
import { useCreateChildrenDoc } from '../api/useCreateChildren';
import { useDocChildren } from '../api/useDocChildren';
import { TreeViewDataType } from '../types/tree';

import { DocTreeDataType } from './DocTree';

type DocTreeItemProps = NodeRendererProps<TreeViewDataType<DocTreeDataType>>;

export const DocTreeItem = ({ node, ...props }: DocTreeItemProps) => {
  const data = node.data;
  const deleteModal = useModal();
  const shareModal = useModal();
  const renameModal = useModal();
  const [isOpen, setIsOpen] = useState(false);
  const { updateNode, setSelectedNode } = useTreeStore();
  const { spacingsTokens } = useCunninghamTheme();
  const { refetch } = useDocChildren(
    {
      docId: data.id,
      page: 1,
    },
    { enabled: false },
  );

  const { t } = useTranslation();
  const router = useRouter();
  const { togglePanel } = useLeftPanelStore();
  const { mutate: createChildrenDoc } = useCreateChildrenDoc({
    onSuccess: (doc) => {
      const actualChildren = node.data.children ?? [];
      if (actualChildren.length === 0) {
        loadChildren()
          .then(() => {
            node.open();
            router.push(`/docs/${doc.id}`);
            togglePanel();
          })
          .catch(console.error);
      } else {
        updateNode(node.id, {
          ...node.data,
          children: [...actualChildren, doc],
        });
        node.open();
        router.push(`/docs/${doc.id}`);
        togglePanel();
      }
      setSelectedNode(doc);
    },
  });
  const spacing = spacingsTokens();

  const loadChildren = async () => {
    const data = await refetch();
    console.log(data, node);
    const childs = data.data?.results ?? [];
    const newChilds: TreeViewDataType<DocTreeDataType>[] = childs.map(
      (child) => ({
        ...child,
        childrenCount: child.numchild,
        children: [],
        parentId: node.id,
      }),
    );
    node.data.children = newChilds;
    updateNode(node.id, { ...node.data, children: newChilds });
    return newChilds;
  };

  const options = [
    {
      label: t('Rename'),
      icon: 'edit',
      callback: renameModal.open,
    },
    {
      label: t('Share'),
      icon: 'group',
      callback: shareModal.open,
    },
    {
      label: t('Delete'),
      icon: 'delete',
      callback: deleteModal.open,
    },
  ];
  return (
    <>
      <TreeViewNode
        onClick={() => router.push(`/docs/${node.data.id}`)}
        node={node}
        {...props}
        loadChildren={loadChildren}
      >
        <LightDocItem
          showActions={isOpen}
          doc={node.data}
          rightContent={
            <Box $direction="row" $gap={spacing['xs']} $align="center">
              <DropdownMenu options={options} afterOpenChange={setIsOpen}>
                <Icon iconName="more_horiz" $theme="primary" $variation="600" />
              </DropdownMenu>
              <BoxButton
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  createChildrenDoc({
                    title: t('Untitled page'),
                    parentId: node.id,
                  });
                }}
                color="primary-text"
              >
                <Icon
                  $variation="800"
                  $theme="primary"
                  isFilled
                  iconName="add_box"
                />
              </BoxButton>
            </Box>
          }
        />
      </TreeViewNode>
      {deleteModal.isOpen && (
        <ModalRemoveDoc onClose={deleteModal.onClose} doc={node.data} />
      )}
      {shareModal.isOpen && (
        <DocShareModal doc={node.data} onClose={shareModal.close} />
      )}
      {renameModal.isOpen &&
        createPortal(
          <ModalRenameDoc onClose={renameModal.onClose} doc={node.data} />,
          document.getElementById('modals') as HTMLElement,
        )}
    </>
  );
};
