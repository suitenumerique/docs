import emojiRegex from 'emoji-regex';
import * as Y from 'yjs';

import { Doc, LinkReach, Role, RoleImportance } from './types';

export const base64ToYDoc = (base64: string) => {
  const uint8Array = Buffer.from(base64, 'base64');
  const ydoc = new Y.Doc();
  Y.applyUpdate(ydoc, uint8Array);
  return ydoc;
};

export const base64ToBlocknoteXmlFragment = (base64: string) => {
  return base64ToYDoc(base64).getXmlFragment('document-store');
};

export const getDocLinkReach = (doc: Doc): LinkReach => {
  return doc.computed_link_reach ?? doc.link_reach;
};

export const getDocLinkRole = (doc: Doc): Doc['link_role'] => {
  return doc.computed_link_role ?? doc.link_role;
};

/**
 * The role the user effectively has on the doc: the higher of their own
 * access and the link role, which may be inherited from an ancestor.
 */
export const getDocRole = (doc: Doc): Role => {
  const roles: Role[] = [Role.READER];
  const linkRole = getDocLinkRole(doc);

  if (doc.user_role) {
    roles.push(doc.user_role);
  }
  if (linkRole) {
    // LinkRole values are a subset of the Role ones
    roles.push(linkRole as unknown as Role);
  }

  return roles.reduce((highest, role) =>
    RoleImportance[role] > RoleImportance[highest] ? role : highest,
  );
};

export const getEmojiAndTitle = (title: string) => {
  // Use emoji-regex library for comprehensive emoji detection compatible with ES5
  const regex = emojiRegex();

  // Ignore leading spaces when checking for a leading emoji
  const trimmedTitle = title.trimStart();
  const match = trimmedTitle.match(regex);

  if (match && trimmedTitle.startsWith(match[0])) {
    const emoji = match[0];
    const titleWithoutEmoji = trimmedTitle.substring(emoji.length).trim();
    return { emoji, titleWithoutEmoji };
  }

  return { emoji: null, titleWithoutEmoji: title };
};
