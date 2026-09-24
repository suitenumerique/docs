import {
  Button,
  Modal,
  ModalSize,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/cunningham-react';
import { Spinner } from '@gouvfr-lasuite/ui-kit';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Y from 'yjs';

import { TextErrors } from '@/components';
import { createDocAttachment } from '@/docs/doc-editor/api';
import { useAuth } from '@/features/auth';
import { useVaultClient } from '@/features/docs/doc-collaboration/vault';
import {
  Doc,
  EncryptionTransitionEvent,
  KEY_DOC,
  KEY_LIST_DOC,
  extractAttachmentKeysAndMetadata,
  useProviderStore,
  useRemoveDocEncryption,
} from '@/features/docs/doc-management';
import { useKeyboardAction } from '@/hooks';

import { EncryptionModalContent } from './EncryptionLayout';

/**
 * Decrypt existing encrypted attachments using the vault and upload decrypted copies.
 */
const decryptRemoteAttachments = async (
  yDoc: Y.Doc,
  docId: string,
  vaultClient: VaultClient,
  encryptedSymmetricKey: ArrayBuffer,
  keyVersion: number,
): Promise<Record<string, string>> => {
  const attachmentKeysAndMetadata = extractAttachmentKeysAndMetadata(yDoc);

  if (attachmentKeysAndMetadata.size === 0) {
    return {};
  }

  const attachmentKeyMapping: Record<string, string> = {};

  for (const [oldAttachmentKey, oldAttachmentMetadata] of Array.from(
    attachmentKeysAndMetadata.entries(),
  )) {
    const response = await fetch(oldAttachmentMetadata.mediaUrl, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('attachment cannot be fetched');
    }

    // Decrypt via vault — pure ArrayBuffer
    const encryptedBuffer = await response.arrayBuffer();
    const { data: decryptedBuffer } = await vaultClient.decryptWithKey(
      encryptedBuffer,
      encryptedSymmetricKey,
      keyVersion,
    );

    const fileName = oldAttachmentMetadata.name ?? 'file';
    const decryptedFile = new File([decryptedBuffer], fileName);

    const body = new FormData();
    body.append('file', decryptedFile);

    const result = await createDocAttachment({ docId, body });

    const newKey = new URL(
      result.file,
      window.location.origin,
    ).searchParams.get('key');

    if (!newKey) {
      throw new Error('file key must be provided once uploaded');
    }

    attachmentKeyMapping[oldAttachmentKey] = newKey;
  }

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

interface ModalRemoveDocEncryptionProps {
  doc: Doc;
  encryptedSymmetricKey: ArrayBuffer;
  onClose: () => void;
}

export const ModalRemoveDocEncryption = ({
  doc,
  encryptedSymmetricKey,
  onClose,
}: ModalRemoveDocEncryptionProps) => {
  const { t } = useTranslation();
  const { toast } = useToastProvider();
  const { provider, notifyOthers, startEncryptionTransition } =
    useProviderStore();
  const { client: vaultClient } = useVaultClient();
  const { user } = useAuth();

  const [isPending, setIsPending] = useState(false);

  const {
    mutateAsync: removeDocEncryption,
    isError,
    error,
  } = useRemoveDocEncryption({
    listInvalidQueries: [KEY_DOC, KEY_LIST_DOC],
  });

  const keyboardAction = useKeyboardAction();

  const handleClose = () => {
    if (isPending) {
      return;
    }
    onClose();
  };

  const handleRemoveEncryption = async () => {
    if (!provider || isPending || !vaultClient) {
      return;
    }

    setIsPending(true);

    try {
      notifyOthers(EncryptionTransitionEvent.REMOVE_ENCRYPTION_STARTED);

      const ongoingDoc = new Y.Doc();
      Y.applyUpdate(ongoingDoc, Y.encodeStateAsUpdate(provider.document));

      const attachmentKeyMapping = await decryptRemoteAttachments(
        ongoingDoc,
        doc.id,
        vaultClient,
        encryptedSymmetricKey,
        (user?.suite_user_id
          ? doc.accesses_versions_per_user?.[user.suite_user_id]
          : undefined) ?? 1,
      );

      const ongoingDocState = Y.encodeStateAsUpdate(ongoingDoc);
      ongoingDoc.destroy();

      await removeDocEncryption({
        docId: doc.id,
        content: ongoingDocState,
        attachmentKeyMapping,
      });

      toast(t('Encryption has been removed.'), VariantType.SUCCESS, {
        duration: 4000,
      });

      notifyOthers(EncryptionTransitionEvent.REMOVE_ENCRYPTION_SUCCEEDED);
      startEncryptionTransition('removing-encryption');
    } catch (err) {
      notifyOthers(EncryptionTransitionEvent.REMOVE_ENCRYPTION_CANCELED);
      console.error(err);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Modal
      isOpen
      closeOnClickOutside
      onClose={handleClose}
      size={ModalSize.SMALL}
      aria-label={t('Remove encryption')}
    >
      <EncryptionModalContent
        illustration="document-shield-x"
        title={t('Remove encryption')}
        description={t(
          'The document will be decrypted and stored in plain text on the server.',
        )}
        actions={
          <>
            <Button
              fullWidth
              onClick={() => void handleRemoveEncryption()}
              disabled={isPending}
              {...keyboardAction(() => void handleRemoveEncryption())}
            >
              {isPending ? <Spinner /> : t('Remove encryption')}
            </Button>
            <Button
              variant="bordered"
              color="neutral"
              fullWidth
              onClick={handleClose}
              disabled={isPending}
            >
              {t('Cancel')}
            </Button>
          </>
        }
      >
        {isError && error && <TextErrors causes={error.cause} />}
      </EncryptionModalContent>
    </Modal>
  );
};
