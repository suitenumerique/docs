import { TreeViewDataType } from '@gouvfr-lasuite/ui-kit';

import { Doc, Role } from '../doc-management';

export const serializeDocToSubPage = (doc: Doc): Doc => {
  return { ...doc, childrenCount: doc.numchild };
};

export const subPageToTree = (children: Doc[]): TreeViewDataType<Doc>[] => {
  children.forEach((child) => {
    child.childrenCount = child.numchild ?? 0;
    subPageToTree(child.children ?? []);
  });
  return children;
};

export const isOwnerOrAdmin = (doc: Doc): boolean => {
  return doc.user_roles.some(
    (role) => role === Role.OWNER || role === Role.ADMIN,
  );
};

export const canDrag = (doc: Doc): boolean => {
  return isOwnerOrAdmin(doc);
};

export const canDrop = (doc: Doc): boolean => {
  return isOwnerOrAdmin(doc);
};
