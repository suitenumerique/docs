import {
  TreeContext,
  TreeContextType,
  TreeDataItem,
  TreeViewDataType,
  TreeViewNodeTypeEnum,
} from '@gouvfr-lasuite/ui-components';
import { useContext } from 'react';
import { css } from 'styled-components';

// Type-only: a value import would create a cycle through `doc-management`,
// leaving the constants below undefined at render time.
import type { Doc } from '../doc-management';

export const CLASS_TREE_ITEM_ACTIONS = 'doc-tree-root-item-actions';

/** Wraps a tree item's action buttons, revealed by CSS on hover / focus. */
export const CLASS_TREE_ITEM_ACTIONS_WRAPPER = '--docs--doc-tree-item-actions';

export const ID_TREE_KEYBOARD_INSTRUCTIONS = 'doc-tree-keyboard-instructions';

/**
 * Reveals a tree item's actions, to apply on the item itself. They stay
 * mounted, so that closing the options menu always has a live trigger to give
 * the focus back to; `opacity` rather than `visibility`, which would keep F2
 * from reaching them.
 *
 * `data-menu-open` covers the open menu, whose focus sits in a portal, and the
 * `c__tree-view--row` ancestor the sub pages, focused on the row rather than on
 * the item.
 */
export const treeItemActionsRevealCss = css`
  .${CLASS_TREE_ITEM_ACTIONS_WRAPPER} {
    opacity: 0;
    pointer-events: none;
  }

  &:hover,
  &:focus-within,
  &[data-menu-open],
  .c__tree-view--row:focus-within & {
    .${CLASS_TREE_ITEM_ACTIONS_WRAPPER} {
      opacity: 1;
      pointer-events: auto;
    }
  }

  @media (hover: none) {
    .${CLASS_TREE_ITEM_ACTIONS_WRAPPER} {
      opacity: 1;
      pointer-events: auto;
    }
  }
`;

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
 *
 * Data only: it runs long after the interaction, so it must never move the
 * focus.
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
    return;
  }

  if (treeContext.treeData.getNode(docId)) {
    treeContext.treeData.updateNode(docId, data);
  }
};

/**
 * Same as `syncDocInTree`, for fields the tree does not display.
 *
 * `updateNode` re-renders the row, which re-inserts its DOM node and drops the
 * focus inside it. Mutating the value skips the render: the options menu is the
 * only reader, and it is remounted on each open.
 */
export const patchDocInTree = (
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
    return;
  }

  const node = treeContext.treeData.getNode(docId);
  if (node) {
    Object.assign(node, data);
  }
};

export const reloadTree = (treeContext: TreeContextType<Doc | null> | null) => {
  treeContext?.setRoot(null);
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
