import * as Y from 'yjs';

import { createDocAttachment } from '@/docs/doc-editor/api';

import { extractAttachmentKeysAndMetadata } from './utils';

/**
 * encrypt existing unencrypted attachments and return:
 * - a modified Yjs state with URLs pointing to new encrypted files
 * - a mapping of old S3 keys to new ones (for backend cleanup)
 *
 * originals are never modified so if the process fails midway the document
 * still works with its original unencrypted attachments.
 */
const encryptRemoteAttachments = async (
  yDoc: Y.Doc,
  docId: string,
  vaultClient: VaultClient,
  encryptedSymmetricKey: ArrayBuffer,
): Promise<Record<string, string>> => {
  const attachmentKeysAndMetadata = extractAttachmentKeysAndMetadata(yDoc);

  // if no attachment it's straightforward
  if (attachmentKeysAndMetadata.size === 0) {
    return {};
  }

  // otherwise upload encrypted copies as new attachments and collect the mapping
  const attachmentKeyMapping: Record<string, string> = {};

  for (const [oldAttachmentKey, oldAttachmentMetadata] of Array.from(
    attachmentKeysAndMetadata.entries(),
  )) {
    const response = await fetch(oldAttachmentMetadata.mediaUrl, {
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error('attachment cannot be fetch');
    }

    // Encrypt file via vault — pure ArrayBuffer, no base64 conversion
    const fileBuffer = await response.arrayBuffer();
    const { encryptedData: encryptedBuffer } = await vaultClient.encryptWithKey(
      fileBuffer,
      encryptedSymmetricKey,
    );
    const encryptedBytes = new Uint8Array(encryptedBuffer);

    const fileName = oldAttachmentMetadata.name ?? 'file'; // since encrypted we could not reuse the file name that can be stored as clear text
    const encryptedFile = new File([encryptedBytes], fileName, {
      type: 'application/octet-stream',
    });

    const body = new FormData();
    body.append('file', encryptedFile);
    body.append('is_encrypted', 'true');

    const result = await createDocAttachment({ docId, body });

    // result.file is like "/api/v1.0/documents/{id}/media-check/?key={newKey}"
    const newKey = new URL(
      result.file,
      window.location.origin,
    ).searchParams.get('key');

    if (!newKey) {
      throw new Error('file key must be provided once uploaded');
    }

    attachmentKeyMapping[oldAttachmentKey] = newKey;
  }

  // once uploaded, we can update all nodes referencing attachments with their new key
  yDoc.transact(() => {
    for (const [oldAttachmentKey, oldAttachmentMetadata] of Array.from(
      attachmentKeysAndMetadata.entries(),
    )) {
      const newMediaUrl = oldAttachmentMetadata.mediaUrl.replace(
        oldAttachmentKey,
        attachmentKeyMapping[oldAttachmentKey],
      );

      for (const node of oldAttachmentMetadata.nodes) {
        node.setAttribute('url', newMediaUrl);
      }
    }
  });

  return attachmentKeyMapping;
};

/**
 * A document's content and attachments encrypted under one new key, wrapped for
 * `recipients`. The attachments are encrypted with the caller's wrap of that key,
 * so with no wrap for `currentUserSub` they stay as they are.
 */
export const encryptDocContent = async ({
  yDoc,
  docId,
  vaultClient,
  recipients,
  currentUserSub,
}: {
  yDoc: Y.Doc;
  docId: string;
  vaultClient: VaultClient;
  recipients: Record<string, { email: string; name?: string }>;
  currentUserSub?: string | null;
}) => {
  const { encryptedContent, encryptedKeys, maintenanceKey } =
    await vaultClient.encryptWithoutKey(
      Y.encodeStateAsUpdate(yDoc).buffer as ArrayBuffer,
      recipients,
    );
  const currentUserEncryptedKey = currentUserSub
    ? encryptedKeys[currentUserSub]
    : undefined;
  const attachmentKeyMapping = currentUserEncryptedKey
    ? await encryptRemoteAttachments(
        yDoc,
        docId,
        vaultClient,
        currentUserEncryptedKey,
      )
    : {};
  let content = new Uint8Array(encryptedContent);

  // The content was encrypted before its blocks pointed at the encrypted
  // copies, and the backend deletes the plaintext attachments: encrypt it
  // again, under the same key, once the links are rewritten.
  if (currentUserEncryptedKey && Object.keys(attachmentKeyMapping).length) {
    const { encryptedData } = await vaultClient.encryptWithKey(
      Y.encodeStateAsUpdate(yDoc).buffer as ArrayBuffer,
      currentUserEncryptedKey,
    );
    content = new Uint8Array(encryptedData);
  }

  return {
    encryptedContent: content,
    encryptedKeys,
    maintenanceKey,
    attachmentKeyMapping,
  };
};
