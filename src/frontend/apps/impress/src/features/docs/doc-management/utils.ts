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

export const getDocLinkReach = (doc: Doc) => {
  if (doc.computed_link_reach) {
    return doc.computed_link_reach;
  }
  return doc.link_reach;
};

export const getDocLinkRole = (doc: Doc) => {
  if (doc.computed_link_role) {
    return doc.computed_link_role;
  }
  return doc.link_role;
};

export const docLinkIsDesync = (doc: Doc) => {
  // If the document has no ancestors
  if (!doc.ancestors_link_reach) {
    return false;
  }

  return (
    doc.computed_link_reach !== doc.ancestors_link_reach ||
    doc.computed_link_role !== doc.ancestors_link_role
  );
};
