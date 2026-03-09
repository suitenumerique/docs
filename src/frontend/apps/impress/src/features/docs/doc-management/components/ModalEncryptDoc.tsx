import {
  Alert,
  Button,
  Modal,
  ModalSize,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/cunningham-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Y from 'yjs';

import { Box, ButtonCloseModal, Icon, Text, TextErrors } from '@/components';
import {
  encryptContent,
  generateSymmetricKey,
  prepareEncryptedSymmetricKeysForUsers,
  useUserEncryption,
} from '@/docs/doc-collaboration';
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
  symmetricKey: CryptoKey,
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

    const fileBytes = new Uint8Array(await response.arrayBuffer());
    const encryptedBytes = await encryptContent(fileBytes, symmetricKey);

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

  const membersWithoutKey = useMemo(() => {
    if (!accesses || !doc.accesses_public_keys_per_user) {
      return [];
    }

    const publicKeysMap = doc.accesses_public_keys_per_user;

    return accesses.filter(
      (access) => access.user && !publicKeysMap[access.user.id],
    );
  }, [accesses, doc.accesses_public_keys_per_user]);

  const hasEncryptionKeys = !!encryptionSettings;

  const canEncrypt =
    hasEncryptionKeys &&
    isRestricted &&
    !hasPendingInvitations &&
    membersWithoutKey.length === 0;

  const handleClose = () => {
    if (isPending) {
      return;
    }
    onClose();
  };

  const handleEncrypt = async () => {
    if (!provider || !user || isPending || !canEncrypt || !encryptionSettings) {
      return;
    }

    setIsPending(true);

    try {
      notifyOthers(EncryptionTransitionEvent.ENCRYPTION_STARTED);

      const documentSymmetricKey = await generateSymmetricKey();

      // Their public key are base64 encoded, decoding the whole
      const usersPublicKeys: Record<string, ArrayBuffer> = {};

      if (doc.accesses_public_keys_per_user) {
        // TODO:
        // TODO: should throw if missing public keys according to current accesses
        // TODO:

        for (const [userId, publicKey] of Object.entries(
          doc.accesses_public_keys_per_user,
        )) {
          usersPublicKeys[userId] = Buffer.from(publicKey, 'base64').buffer;
        }
      } else {
        // if it has been not provided it's weird because it should only happen for people not authenticated
        throw new Error(`"accesses_public_keys_per_user" should be provided`);
      }

      // Prepare encrypted symmetric keys for all users with access
      const encryptedSymmetricKeyPerUser =
        await prepareEncryptedSymmetricKeysForUsers(
          documentSymmetricKey,
          usersPublicKeys,
        );

      // clone the Yjs document since performing changes during encryption that require backend confirmation
      // once successfully done it can be used locally
      const ongoingDoc = new Y.Doc();
      Y.applyUpdate(ongoingDoc, Y.encodeStateAsUpdate(provider.document));

      // encrypt existing attachments
      const attachmentKeyMapping = await encryptRemoteAttachments(
        ongoingDoc,
        doc.id,
        documentSymmetricKey,
      );

      const ongoingDocState = Y.encodeStateAsUpdate(ongoingDoc);

      // we have no need of patching back the current Yjs document with modifications
      // since an encryption success will refetch data from the backend
      ongoingDoc.destroy();

      const encryptedContent = await encryptContent(
        new Uint8Array(ongoingDocState),
        documentSymmetricKey,
      );

      // TODO:
      // TODO: if none it should at least make it for the current user
      // TODO: so it makes sense `accesses_public_keys_per_user` is always passed?
      // TODO:

      await encryptDoc({
        docId: doc.id,
        content: encryptedContent,
        encryptedSymmetricKeyPerUser,
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
                      membersWithoutKey.length === 0 ? 'check_circle' : 'cancel'
                    }
                    $size="sm"
                    $theme={
                      membersWithoutKey.length === 0 ? 'success' : 'error'
                    }
                  />
                  <Text
                    $size="sm"
                    $weight={membersWithoutKey.length === 0 ? '400' : '600'}
                    $theme={
                      membersWithoutKey.length === 0 ? undefined : 'error'
                    }
                  >
                    {membersWithoutKey.length === 0
                      ? t('All members have encryption enabled')
                      : t(
                          '{{count}} member(s) have not enabled encryption yet',
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
