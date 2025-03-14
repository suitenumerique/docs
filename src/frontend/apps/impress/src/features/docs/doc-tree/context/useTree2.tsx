/* eslint-disable @typescript-eslint/unbound-method */
import { TreeDataItem, TreeViewMoveResult } from '@gouvfr-lasuite/ui-kit';
import { useState } from 'react';
import { useTreeData } from 'react-stately';

import { Doc } from '../../doc-management';
import { TreeViewDataType } from '../types/tree';

export const useTree2 = (
  initialItems: TreeViewDataType<Doc>[],
  refreshCallback?: (id: string) => Promise<Partial<TreeViewDataType<Doc>>>,
  loadChildrenCallback?: (id: string) => Promise<TreeViewDataType<Doc>[]>,
) => {
  const {
    remove,
    update,
    insert,
    insertBefore,
    insertAfter,
    append,
    prepend,
    getItem,
    move,
    items: treeData,
  } = useTreeData({
    initialItems: initialItems,
    getKey: (item) => {
      return item.id;
    },
    getChildren: (item) => item.children || [],
  });

  const [selectedNode, setSelectedNode] = useState<Doc>();

  const resetTree = (newItems: TreeViewDataType<Doc>[] = []) => {
    const allNodes = treeData.map((node) => {
      return node.key;
    });

    remove(...allNodes);
    const data = JSON.parse(
      JSON.stringify(newItems),
    ) as TreeViewDataType<Doc>[];
    if (data.length > 0) {
      insert(null, 0, ...data);
    }

    setSelectedNode(undefined);
  };

  // Ajouter un enfant à un nœud spécifique
  const addChild = (
    parentId: string | null,
    newNode: TreeViewDataType<Doc>,
  ) => {
    if (parentId) {
      const parent = getItem(parentId);
      if (parent) {
        insert(parentId, parent.children?.length ?? 0, newNode);
        addToSubItems(parentId, newNode);
      }
    }
    if (!parentId) {
      insert(null, treeData.length, newNode);
    }
  };

  // Mettre à jour un nœud
  const updateNode = (
    nodeId: string,
    updatedData: Partial<TreeViewDataType<Doc>>,
  ) => {
    const item = getItem(nodeId);

    if (!item) {
      console.error('No item found -- updateNode');
      return;
    }

    let newSubItems: TreeViewDataType<Doc>[] | null =
      item.value.children ?? null;

    // if (item.children && item.children.length > 0) {
    //   newSubItems = item.children?.map((child) => child.value) ?? null;
    // }

    if (updatedData.children) {
      newSubItems = [...(newSubItems ?? []), ...updatedData.children];
    }

    const updatedItem: TreeViewDataType<Doc> = {
      ...item.value,
      ...updatedData,
      children: newSubItems,
      childrenCount: newSubItems?.length ?? item.value.childrenCount,
    } as TreeViewDataType<Doc>;

    console.log('updatedItem', updatedItem, item);

    update(nodeId, updatedItem);
  };

  // Supprimer un nœud
  const deleteNode = (nodeId: string) => {
    const toDelete = getItem(nodeId);
    const oldParentId = toDelete?.parentKey as string;
    if (oldParentId && toDelete) {
      removeFromSubItems(oldParentId, toDelete.value.id);
    }
    remove(nodeId);
  };

  const refreshNode = async (nodeId: string) => {
    if (!refreshCallback) {
      console.error('No refresh callback provided');
      return;
    }
    try {
      const updatedData = await refreshCallback(nodeId);
      console.log('updatedData', updatedData);
      updateNode(nodeId, updatedData);
    } catch (error) {
      console.error('error while refreshing node:', error);
    }
  };

  const addRootNode = (newNode: TreeViewDataType<Doc>) => {
    insert(null, treeData.length, newNode);
  };

  // Définir ou fusionner les enfants d'un nœud
  const setChildren = (
    parentId: string,
    newChildren: TreeViewDataType<Doc>[],
  ) => {
    const item = getItem(parentId);
    if (!item) {
      console.error('No item found');
      return;
    }

    const updatedItem = {
      ...item.value,
      children: newChildren,
      childrenCount: newChildren.length,
    } as TreeViewDataType<Doc>;

    update(parentId, updatedItem);
  };

  const insertBeforeNode = (nodeId: string, newNode: TreeViewDataType<Doc>) => {
    insertBefore(nodeId, newNode);
  };

  const insertAfterNode = (nodeId: string, newNode: TreeViewDataType<Doc>) => {
    insertAfter(nodeId, newNode);
  };

  const appendToNode = (nodeId: string, newNode: TreeViewDataType<Doc>) => {
    append(nodeId, newNode);
  };

  const prependToNode = (nodeId: string, newNode: TreeViewDataType<Doc>) => {
    prepend(nodeId, newNode);
  };

  const selectNodeById = (nodeId: string) => {
    const item = getItem(nodeId);
    if (!item) {
      return;
    }
    setSelectedNode(item.value as Doc);
  };

  const removeFromSubItems = (parentId: string, subItemId: string) => {
    const item = getItem(parentId);
    if (!item) {
      return;
    }
    const subItems = item.value.children ?? [];
    const newSubItems = subItems.filter((subItem) => subItem.id !== subItemId);
    item.value.children = newSubItems;
    item.value.childrenCount = newSubItems.length;
  };

  const addToSubItems = (parentId: string, subItem: TreeViewDataType<Doc>) => {
    const item = getItem(parentId);
    if (!item) {
      return;
    }
    const subItems = item.value.children ?? [];
    const newSubItems = [...subItems, subItem];
    item.value.children = newSubItems;
    item.value.childrenCount = newSubItems.length;
  };

  const moveNode = (
    nodeId: string,
    newParentId: string | null,
    newIndex: number,
    oldParentId?: string | null,
  ) => {
    const toMove = getItem(nodeId)?.value;
    move(nodeId, newParentId, newIndex);

    if (newParentId && toMove) {
      addToSubItems(newParentId, toMove);
    }

    if (oldParentId) {
      removeFromSubItems(oldParentId, nodeId);
    }
  };

  const handleMove = (result: TreeViewMoveResult) => {
    moveNode(
      result.sourceId,
      result.newParentId,
      result.index,
      result.oldParentId,
    );
  };

  const handleLoadChildren = async (nodeId: string) => {
    if (!loadChildrenCallback) {
      return [];
    }
    const children = await loadChildrenCallback(nodeId);

    updateNode(nodeId, {
      children: children,
      hasLoadedChildren: true,
      childrenCount: children.length,
    });
    return children;
  };

  return {
    nodes: treeData as TreeDataItem<TreeViewDataType<Doc>>[],
    addChild,
    updateNode,
    deleteNode,
    addRootNode,
    selectedNode,
    setSelectedNode,
    refreshNode,
    setChildren,
    insertBeforeNode,
    insertAfterNode,
    handleMove,
    prependToNode,
    moveNode,
    appendToNode,
    move,
    resetTree,
    handleLoadChildren,
    selectNodeById,
  };
};
