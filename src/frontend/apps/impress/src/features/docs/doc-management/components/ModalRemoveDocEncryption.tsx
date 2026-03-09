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

import { Box, ButtonCloseModal, Text, TextErrors } from '@/components';
import { decryptContent } from '@/docs/doc-collaboration';
import { createDocAttachment } from '@/docs/doc-editor/api';
import {
  Doc,
  EncryptionTransitionEvent,
  KEY_DOC,
  KEY_LIST_DOC,
  extractAttachmentKeysAndMetadata,
  useRemoveDocEncryption,
  useProviderStore,
} from '@/features/docs/doc-management';
import { useKeyboardAction } from '@/hooks';

/**
 * Decrypt existing encrypted attachments and return:
 * - a mapping of old S3 keys to new ones (for backend cleanup)
 *
 * The yDoc nodes are updated in place with the new URLs.
 * Originals are never modified so if the process fails midway the document
 * still works with its original encrypted attachments.
 */
const decryptRemoteAttachments = async (
  yDoc: Y.Doc,
  docId: string,
  symmetricKey: CryptoKey,
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

    const encryptedBytes = new Uint8Array(await response.arrayBuffer());
    const decryptedBytes = await decryptContent(encryptedBytes, symmetricKey);

    const fileName = oldAttachmentMetadata.name ?? 'file';
    const decryptedFile = new File([decryptedBytes as BlobPart], fileName);

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

  // once uploaded, update all nodes referencing attachments with their new key
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
  symmetricKey: CryptoKey;
  onClose: () => void;
}

export const ModalRemoveDocEncryption = ({
  doc,
  symmetricKey,
  onClose,
}: ModalRemoveDocEncryptionProps) => {
  const { t } = useTranslation();
  const { toast } = useToastProvider();
  const { provider, notifyOthers, startEncryptionTransition } =
    useProviderStore();

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
    if (!provider || isPending) {
      return;
    }

    setIsPending(true);

    try {
      notifyOthers(EncryptionTransitionEvent.REMOVE_ENCRYPTION_STARTED);

      // clone the Yjs document since performing changes during decryption
      // that require backend confirmation
      const ongoingDoc = new Y.Doc();
      Y.applyUpdate(ongoingDoc, Y.encodeStateAsUpdate(provider.document));

      // decrypt existing encrypted attachments
      const attachmentKeyMapping = await decryptRemoteAttachments(
        ongoingDoc,
        doc.id,
        symmetricKey,
      );

      const ongoingDocState = Y.encodeStateAsUpdate(ongoingDoc);

      // we have no need of patching back the current Yjs document with modifications
      // since a removing encryption success will refetch data from the backend
      ongoingDoc.destroy();

      await removeDocEncryption({
        docId: doc.id,
        content: ongoingDocState,
        attachmentKeyMapping,
      });

      toast(
        t('The document encryption has been removed.'),
        VariantType.SUCCESS,
        { duration: 4000 },
      );

      // notify other users before destroying the provider since websocket connection needed
      notifyOthers(EncryptionTransitionEvent.REMOVE_ENCRYPTION_SUCCEEDED);

      // trigger the provider switch (relay → hocuspocus):
      startEncryptionTransition('removing-encryption');

      onClose();
    } catch (error) {
      notifyOthers(EncryptionTransitionEvent.REMOVE_ENCRYPTION_CANCELED);

      throw error;
    } finally {
      setIsPending(false);
    }
  };

  const handleCloseKeyDown = keyboardAction(handleClose);
  const handleRemoveEncryptionKeyDown = keyboardAction(handleRemoveEncryption);

  return (
    <Modal
      isOpen
      closeOnClickOutside={!isPending}
      hideCloseButton
      onClose={handleClose}
      aria-describedby="modal-remove-doc-encryption-title"
      rightActions={
        <>
          <Button
            variant="secondary"
            fullWidth
            onClick={handleClose}
            onKeyDown={handleCloseKeyDown}
            disabled={isPending}
          >
            {t('Cancel')}
          </Button>
          <Button
            color="error"
            fullWidth
            onClick={handleRemoveEncryption}
            onKeyDown={handleRemoveEncryptionKeyDown}
            disabled={isPending}
            icon={
              isPending ? (
                <div>
                  <Spinner size="sm" />
                </div>
              ) : undefined
            }
          >
            {t('Confirm')}
          </Button>
        </>
      }
      size={ModalSize.MEDIUM}
      title={
        <Box
          $direction="row"
          $justify="space-between"
          $align="center"
          $width="100%"
        >
          <Text
            $size="h6"
            as="h1"
            id="modal-remove-doc-encryption-title"
            $margin="0"
            $align="flex-start"
          >
            {t('Remove document encryption')}
          </Text>
          <ButtonCloseModal
            aria-label={t('Close the encryption removal modal')}
            onClick={handleClose}
            onKeyDown={handleCloseKeyDown}
            disabled={isPending}
          />
        </Box>
      }
    >
      <Box className="--docs--modal-remove-doc-encryption" $gap="sm">
        {!isError && (
          <Text $size="sm" $variation="secondary">
            {t(
              'Removing encryption will decrypt the document and make it accessible without encryption keys. The document content will be stored in plain text on the server.',
            )}
          </Text>
        )}

        {isError && <TextErrors causes={error.cause} />}
      </Box>
    </Modal>
  );
};
