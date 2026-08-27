import {
  TreeDataItem,
  TreeViewDataType,
  TreeViewNodeTypeEnum,
} from '@gouvfr-lasuite/ui-components';

import { Doc } from '../doc-management';

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
