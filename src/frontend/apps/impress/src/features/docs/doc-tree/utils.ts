import {
  TreeContext,
  TreeContextType,
  TreeDataItem,
  TreeViewDataType,
  TreeViewNodeTypeEnum,
} from '@gouvfr-lasuite/ui-components';
import { useContext } from 'react';

import { Doc } from '../doc-management';

export const CLASS_TREE_ITEM_ACTIONS = 'doc-tree-root-item-actions';

export const isWithinTreeItemActions = (event: React.SyntheticEvent) =>
  !!(event.target as HTMLElement | null)?.closest(
    `.${CLASS_TREE_ITEM_ACTIONS}`,
  );

/**
 * Type guard to check if a tree node value is a Doc (as opposed to a
 * ui-kit synthetic node like VIEW_MORE, SEPARATOR, TITLE, or SIMPLE_NODE).
 */
export const isDocNode = (
  value: TreeViewDataType<Doc>,
): value is TreeViewDataType<Doc> & Doc => {
  return !value.nodeType || value.nodeType === TreeViewNodeTypeEnum.NODE;
};

export const subPageToTree = (children: Doc[]): TreeViewDataType<Doc>[] => {
  children.forEach((child) => {
    child.childrenCount = child.numchild ?? 0;
    subPageToTree(child.children ?? []);
  });
  return children;
};

export const useTreeContextOrNull = <T = Doc>(): TreeContextType<T> | null =>
  useContext(TreeContext);

/**
 * The doc tree keeps its own copy of each doc (`treeContext.treeData` /
 * `treeContext.root`), which react-query cache invalidations don't reach. Code
 * mutating a doc from a tree item must sync the changed fields into the tree by
 * hand, otherwise the tree UI stays stale until it is reloaded.
 *
 * No-op when there is no tree context (e.g. the doc grid or the doc header),
 * where the react-query cache is the single source of truth.
 */
export const syncDocInTree = (
  treeContext: TreeContextType<Doc> | null,
  docId: string,
  data: Partial<Doc>,
) => {
  if (!treeContext) {
    return;
  }

  const { root } = treeContext;
  if (root && root.id === docId) {
    treeContext.setRoot({ ...root, ...data });
  } else if (treeContext.treeData.getNode(docId)) {
    treeContext.treeData.updateNode(docId, data);
  }

  treeContext.treeApiRef.current?.focus(docId);
};

export const reloadTree = (treeContext: TreeContextType<Doc | null> | null) => {
  treeContext?.setRoot(null);
};

/**
 * Inserts a newly created doc into the tree as a sibling of `parentDocId`
 * (the doc it was created from) and selects it, avoiding a full tree reload.
 */
export const addDocToTree = (
  treeContext: TreeContextType<Doc | null> | null,
  parentDocId: string,
  newDoc: Doc,
) => {
  if (!treeContext) {
    return;
  }

  const parentId = treeContext.treeData.getParentId(parentDocId) as
    string | null;

  treeContext.treeData.addChild(parentId, {
    ...newDoc,
    children: [],
    childrenCount: newDoc.numchild ?? 0,
  });
  treeContext.treeData.setSelectedNode(newDoc);
};

/**
 * Removes a doc from the tree once `navigation` resolves, deferred by the
 * same delay used elsewhere (DocToolBox move/remove) so react-arborist isn't
 * asked to delete a node that's still selected mid route transition.
 */
export const deleteDocFromTreeAfterNavigate = (
  treeContext: TreeContextType<Doc | null> | null,
  docId: string,
  navigation: Promise<unknown>,
) => {
  void navigation.then(() => {
    setTimeout(() => {
      treeContext?.treeData.deleteNode(docId);
    }, 100);
  });
};

export const findIndexInTree = (
  nodes: TreeDataItem<TreeViewDataType<Doc>>[],
  key: string,
) => {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].key === key) {
      return i;
    }
    if (nodes[i].children?.length ?? 0 > 0) {
      const childIndex: number = nodes[i].children
        ? findIndexInTree(nodes[i].children ?? [], key)
        : -1;

      if (childIndex !== -1) {
        return childIndex;
      }
    }
  }
  return -1;
};
