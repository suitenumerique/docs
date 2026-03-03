import emojiRegex from 'emoji-regex';
import * as Y from 'yjs';

import { Doc, LinkReach } from './types';

const UUID =
  '[\\da-fA-F]{8}-[\\da-fA-F]{4}-[\\da-fA-F]{4}-[\\da-fA-F]{4}-[\\da-fA-F]{12}';
const ATTACHMENT_KEY_REGEX = new RegExp(
  `^/media/(${UUID}/attachments/${UUID}(?:-unsafe)?\\.[a-zA-Z0-9]{1,10})$`,
);

export type AttachmentKeyMetadata = {
  mediaUrl: string;
  name?: string;
  nodes: Y.XmlElement[];
};

function traverseYDoc(
  node: Y.XmlElement | Y.XmlFragment,
  callback: (el: Y.XmlElement) => void,
) {
  if (node instanceof Y.XmlElement) {
    callback(node);
  }

  node.toArray().forEach((child) => {
    if (child instanceof Y.XmlElement || child instanceof Y.XmlFragment) {
      traverseYDoc(child, callback);
    }
  });
}

/**
 * Extract unique attachment S3 keys and their Yjs node references
 * from the 'document-store' XmlFragment of a Y.Doc.
 */
export const extractAttachmentKeysAndMetadata = (
  yDoc: Y.Doc,
): Map<string, AttachmentKeyMetadata> => {
  const fragment = yDoc.getXmlFragment('document-store');
  const keysAndMetadata = new Map<string, AttachmentKeyMetadata>();

  yDoc.transact(() => {
    traverseYDoc(fragment, (node) => {
      const urlAttributeValue = node.getAttribute('url');

      if (urlAttributeValue) {
        const url = new URL(urlAttributeValue);
        const match = ATTACHMENT_KEY_REGEX.exec(url.pathname);

        if (match) {
          const key = match[1];
          const keyMetadata = keysAndMetadata.get(key);

          if (keyMetadata) {
            keyMetadata.nodes.push(node);
          } else {
            url.search = '';
            url.hash = '';

            keysAndMetadata.set(key, {
              mediaUrl: url.toString(),
              name: node.getAttribute('name'),
              nodes: [node],
            });
          }
        }
      }
    });
  });

  return keysAndMetadata;
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

export const getDocLinkReach = (doc: Doc): LinkReach => {
  return doc.computed_link_reach ?? doc.link_reach;
};

export const getDocLinkRole = (doc: Doc): Doc['link_role'] => {
  return doc.computed_link_role ?? doc.link_role;
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
