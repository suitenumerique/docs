import {
  Alert,
  Button,
  Modal,
  ModalSize,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/cunningham-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Y from 'yjs';

import { Box, ButtonCloseModal, Icon, Text, TextErrors } from '@/components';
import { toBase64 } from '@/features/docs/doc-editor';
import { useUserEncryption } from '@/docs/doc-collaboration';
import { useVaultClient } from '@/features/docs/doc-collaboration/vault';
import { createDocAttachment } from '@/docs/doc-editor/api';
import { useAuth } from '@/features/auth';
import {
  Doc,
  EncryptionTransitionEvent,
  KEY_DOC,
  KEY_LIST_DOC,
  LinkReach,
  extractAttachmentKeysAndMetadata,
  getDocLinkReach,
  useEncryptDoc,
  useProviderStore,
} from '@/features/docs/doc-management';
import { useDocAccesses } from '@/features/docs/doc-share/api/useDocAccesses';
import { useDocInvitations } from '@/features/docs/doc-share/api/useDocInvitations';
import { useKeyboardAction } from '@/hooks';
import { Spinner } from '@gouvfr-lasuite/ui-kit';

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

interface ModalEncryptDocProps {
  doc: Doc;
  onClose: () => void;
}

export const ModalEncryptDoc = ({ doc, onClose }: ModalEncryptDocProps) => {
  const { t } = useTranslation();
  const { toast } = useToastProvider();
  const { provider, notifyOthers, startEncryptionTransition } =
    useProviderStore();
  const { user } = useAuth();
  const { encryptionSettings } = useUserEncryption();
  const { client: vaultClient } = useVaultClient();

  const [isPending, setIsPending] = useState(false);

  const {
    mutateAsync: encryptDoc,
    isError,
    error,
  } = useEncryptDoc({
    listInvalidQueries: [KEY_DOC, KEY_LIST_DOC],
  });

  const { data: invitationsData } = useDocInvitations({
    docId: doc.id,
    page: 1,
  });

  const { data: accesses } = useDocAccesses({ docId: doc.id });

  const keyboardAction = useKeyboardAction();

  const effectiveReach = getDocLinkReach(doc);
  const isRestricted = effectiveReach === LinkReach.RESTRICTED;
  const hasPendingInvitations = !!invitationsData && invitationsData.count > 0;

  // Fetch public keys from the encryption service to check who has encryption enabled
  const [publicKeysMap, setPublicKeysMap] = useState<Record<string, ArrayBuffer>>({});

  useEffect(() => {
    if (!accesses || !vaultClient) return;

    const userIds = accesses
      .filter((a) => a.user?.suite_user_id)
      .map((a) => a.user.suite_user_id!);

    if (userIds.length === 0) return;

    vaultClient.fetchPublicKeys(userIds)
      .then(({ publicKeys }) => setPublicKeysMap(publicKeys))
      .catch(() => {});
  }, [accesses, vaultClient]);

  const membersWithoutKey = useMemo(() => {
    if (!accesses) {
      return [];
    }

    return accesses.filter(
      (access) => access.user?.suite_user_id && !publicKeysMap[access.user.suite_user_id],
    );
  }, [accesses, publicKeysMap]);

  const hasEncryptionKeys = !!encryptionSettings;

  // Members with no public key will be written to the backend as
  // pending (`null` wrapped key). They'll see the document in their
  // listings but won't be able to decrypt until a validated collaborator
  // accepts them from the share dialog. This no longer blocks
  // encryption — only the degenerate case where NOBODY has a key does.
  const hasAnyPublicKey =
    accesses === undefined || accesses.length === 0
      ? true
      : accesses.some(
          (a) =>
            a.user?.suite_user_id && !!publicKeysMap[a.user.suite_user_id],
        );

  const canEncrypt =
    hasEncryptionKeys &&
    isRestricted &&
    !hasPendingInvitations &&
    hasAnyPublicKey;

  const handleClose = () => {
    if (isPending) {
      return;
    }
    onClose();
  };

  const handleEncrypt = async () => {
    if (!provider || !user || isPending || !canEncrypt || !encryptionSettings || !vaultClient) {
      return;
    }

    setIsPending(true);

    try {
      notifyOthers(EncryptionTransitionEvent.ENCRYPTION_STARTED);

      if (Object.keys(publicKeysMap).length === 0) {
        throw new Error('No public keys available. All members must have encryption enabled.');
      }

      // Clone the Yjs document for encryption
      const ongoingDoc = new Y.Doc();
      Y.applyUpdate(ongoingDoc, Y.encodeStateAsUpdate(provider.document));

      const ongoingDocState = Y.encodeStateAsUpdate(ongoingDoc);

      // Encrypt document content via vault — pure ArrayBuffer
      const { encryptedContent: encryptedContentBuffer, encryptedKeys } =
        await vaultClient.encryptWithoutKey(
          ongoingDocState.buffer as ArrayBuffer,
          publicKeysMap,
        );

      // Contract with /encrypt/: every user on the access list must
      // appear in the payload exactly once. Validated users get their
      // base64 wrapped key; members without a public key yet get
      // explicit null (pending onboarding — they'll be accepted later).
      const encryptedSymmetricKeyPerUser: Record<string, string | null> = {};

      for (const [uid, keyBuffer] of Object.entries(encryptedKeys)) {
        encryptedSymmetricKeyPerUser[uid] = toBase64(new Uint8Array(keyBuffer));
      }
      for (const access of membersWithoutKey) {
        const sub = access.user?.suite_user_id;
        if (sub && !(sub in encryptedSymmetricKeyPerUser)) {
          encryptedSymmetricKeyPerUser[sub] = null;
        }
      }

      // Matched fingerprint map — same set of users, same cardinality.
      // Stored on each DocumentAccess row so the key-mismatch panel can
      // later show users which historical key the doc was encrypted for.
      const encryptionPublicKeyFingerprintPerUser: Record<
        string,
        string | null
      > = {};
      for (const [uid, publicKey] of Object.entries(publicKeysMap)) {
        try {
          encryptionPublicKeyFingerprintPerUser[uid] =
            await vaultClient.computeKeyFingerprint(publicKey);
        } catch (err) {
          console.warn('[encrypt] computeKeyFingerprint failed for', uid, err);
          encryptionPublicKeyFingerprintPerUser[uid] = null;
        }
      }
      for (const access of membersWithoutKey) {
        const sub = access.user?.suite_user_id;
        if (sub && !(sub in encryptionPublicKeyFingerprintPerUser)) {
          encryptionPublicKeyFingerprintPerUser[sub] = null;
        }
      }

      // Get the current user's encrypted key for attachment encryption
      const currentUserEncryptedKey = user.suite_user_id ? encryptedKeys[user.suite_user_id] : undefined;

      // Encrypt existing attachments using the same symmetric key via vault
      let attachmentKeyMapping: Record<string, string> = {};

      if (currentUserEncryptedKey) {
        attachmentKeyMapping = await encryptRemoteAttachments(
          ongoingDoc,
          doc.id,
          vaultClient,
          currentUserEncryptedKey,
        );
      }

      ongoingDoc.destroy();

      const encryptedContent = new Uint8Array(encryptedContentBuffer);

      await encryptDoc({
        docId: doc.id,
        content: encryptedContent,
        encryptedSymmetricKeyPerUser,
        encryptionPublicKeyFingerprintPerUser,
        attachmentKeyMapping,
      });

      toast(t('The document has been encrypted.'), VariantType.SUCCESS, {
        duration: 4000,
      });

      // notify other users before destroying the provider since websocket connection needed
      notifyOthers(EncryptionTransitionEvent.ENCRYPTION_SUCCEEDED);

      // trigger the provider switch (hocuspocus → relay)
      startEncryptionTransition('encrypting');

      onClose();
    } catch (error) {
      notifyOthers(EncryptionTransitionEvent.ENCRYPTION_CANCELED);

      throw error;
    } finally {
      setIsPending(false);
    }
  };

  const handleCloseKeyDown = keyboardAction(handleClose);
  const handleEncryptKeyDown = keyboardAction(handleEncrypt);

  return (
    <Modal
      isOpen
      closeOnClickOutside={!isPending}
      hideCloseButton
      onClose={handleClose}
      aria-describedby="modal-encrypt-doc-title"
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
            color="warning"
            fullWidth
            onClick={handleEncrypt}
            onKeyDown={handleEncryptKeyDown}
            disabled={isPending || !canEncrypt}
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
            id="modal-encrypt-doc-title"
            $margin="0"
            $align="flex-start"
          >
            {t('Encrypt document')}
          </Text>
          <ButtonCloseModal
            aria-label={t('Close the encrypt modal')}
            onClick={handleClose}
            onKeyDown={handleCloseKeyDown}
            disabled={isPending}
          />
        </Box>
      }
    >
      <Box className="--docs--modal-encrypt-doc" $gap="sm">
        {!isError && (
          <Box $gap="sm">
            <Alert type={VariantType.WARNING}>
              <Box $gap="xs">
                <Text $size="sm">
                  {t(
                    'Encrypting a document ensures that only authorized members can read its content. Keep in mind before proceeding any access will then require its user to do the encryption onboarding, with the complication of ensuring keys backups.',
                  )}
                </Text>
              </Box>
            </Alert>

            <Text $size="sm" $variation="secondary">
              {t('Here the conditions that must be met:')}
            </Text>

            <Box $gap="xs">
              <Box $direction="row" $align="center" $gap="xs">
                <Icon
                  iconName={hasEncryptionKeys ? 'check_circle' : 'cancel'}
                  $size="sm"
                  $theme={hasEncryptionKeys ? 'success' : 'error'}
                />
                <Text
                  $size="sm"
                  $weight={hasEncryptionKeys ? '400' : '600'}
                  $theme={hasEncryptionKeys ? undefined : 'error'}
                >
                  {hasEncryptionKeys
                    ? t('Encryption is enabled on your account')
                    : t(
                        'You must enable encryption from your account menu first',
                      )}
                </Text>
              </Box>

              <Box $direction="row" $align="center" $gap="xs">
                <Icon
                  iconName={isRestricted ? 'check_circle' : 'cancel'}
                  $size="sm"
                  $theme={isRestricted ? 'success' : 'error'}
                />
                <Text
                  $size="sm"
                  $weight={isRestricted ? '400' : '600'}
                  $theme={isRestricted ? undefined : 'error'}
                >
                  {isRestricted
                    ? t('Document access is private')
                    : t(
                        'Document must be set to private (currently {{reach}})',
                        {
                          reach:
                            effectiveReach === LinkReach.PUBLIC
                              ? t('public')
                              : t('connected'),
                        },
                      )}
                </Text>
              </Box>

              <Box $direction="row" $align="center" $gap="xs">
                <Icon
                  iconName={!hasPendingInvitations ? 'check_circle' : 'cancel'}
                  $size="sm"
                  $theme={!hasPendingInvitations ? 'success' : 'error'}
                />
                <Text
                  $size="sm"
                  $weight={!hasPendingInvitations ? '400' : '600'}
                  $theme={!hasPendingInvitations ? undefined : 'error'}
                >
                  {!hasPendingInvitations
                    ? t('No pending invitations')
                    : t('Pending invitations must be resolved first')}
                </Text>
              </Box>

              <Box $gap="3xs">
                <Box $direction="row" $align="center" $gap="xs">
                  <Icon
                    iconName={
                      membersWithoutKey.length === 0
                        ? 'check_circle'
                        : 'hourglass_empty'
                    }
                    $size="sm"
                    $theme={
                      membersWithoutKey.length === 0 ? 'success' : 'warning'
                    }
                  />
                  <Text $size="sm">
                    {membersWithoutKey.length === 0
                      ? t('All members have encryption enabled')
                      : t(
                          '{{count}} member(s) haven’t completed encryption onboarding yet. They will be added as pending and won’t be able to decrypt the document until another validated collaborator accepts them from the share dialog.',
                          { count: membersWithoutKey.length },
                        )}
                  </Text>
                </Box>
                {membersWithoutKey.length > 0 && (
                  <Box $margin={{ left: 'sm' }} $gap="3xs">
                    {membersWithoutKey.map((access) => (
                      <Text key={access.id} $size="xs" $variation="secondary">
                        {access.user.full_name || access.user.email}
                      </Text>
                    ))}
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        )}

        {isError && <TextErrors causes={error.cause} />}
      </Box>
    </Modal>
  );
};
