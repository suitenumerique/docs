import * as Y from 'yjs';

import { Doc, Role } from './types';

export const currentDocRole = (abilities: Doc['abilities']): Role => {
  return abilities.destroy
    ? Role.OWNER
    : abilities.accesses_manage
      ? Role.ADMIN
      : abilities.partial_update
        ? Role.EDITOR
        : Role.READER;
};

export const base64ToYDoc = (base64: string) => {
  const uint8Array = Buffer.from(base64, 'base64');
  const ydoc = new Y.Doc();
  Y.applyUpdate(ydoc, uint8Array);
  return ydoc;
};

export const base64ToBlocknoteXmlFragment = (base64: string) => {
  return base64ToYDoc(base64).getXmlFragment('document-store');
};

export const isOwnerOrAdmin = (doc: Doc): boolean => {
  return doc.user_roles.some(
    (role) => role === Role.OWNER || role === Role.ADMIN,
  );
};
