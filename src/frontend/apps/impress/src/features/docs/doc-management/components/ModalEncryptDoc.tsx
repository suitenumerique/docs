import {
  Button,
  Loader,
  Modal,
  ModalSize,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/cunningham-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import * as Y from 'yjs';

import { backendUrl } from '@/api';
import { useState } from 'react';

import { Box, ButtonCloseModal, Icon, Text, TextErrors } from '@/components';
import { useUserUpdate } from '@/core/api/useUserUpdate';
import {
  encryptContent,
  generateSymmetricKey,
  generateUserKeyPair,
  getEncryptionDB,
  prepareEncryptedSymmetricKeysForUsers,
  useUserEncryption,
} from '@/docs/doc-collaboration';
import { createDocAttachment } from '@/docs/doc-editor/api';
import { toBase64 } from '@/docs/doc-editor';
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
  const { mutateAsync: updateUser } = useUserUpdate();

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

  const canEncrypt =
    isRestricted && !hasPendingInvitations && membersWithoutKey.length === 0;

  const handleClose = () => {
    if (isPending) {
      return;
    }
    onClose();
  };

  const handleEncrypt = async () => {
    if (!provider || !user || isPending || !canEncrypt) {
      return;
    }

    setIsPending(true);

    try {
      let currentUserPublicKeyFromThisOnboardingSession: ArrayBuffer | null =
        null;

      // Perform the onboarding if that's the first time using encryption on this device
      if (!encryptionSettings) {
        // TODO: trigger the onboarding, either by creating or retrieving a key from another device
        // TODO: probably the logic should be at a device key level, not user one?

        const userKeyPair = await generateUserKeyPair();

        const encryptionDatabase = await getEncryptionDB();

        // TODO: it should use transaction
        // encryptionDatabase.transaction
        await encryptionDatabase.put(
          'privateKey',
          userKeyPair.privateKey,
          `user:${user.id}`,
        );
        await encryptionDatabase.put(
          'publicKey',
          userKeyPair.publicKey,
          `user:${user.id}`,
        );

        const rawPublicKey = await crypto.subtle.exportKey(
          'spki',
          userKeyPair.publicKey,
        );

        // TODO: it should throw if the backend has already a public key (so the user can with concious forget the old one (but here he did the onboarding already so... it was probably a new device))
        await updateUser({
          id: user.id,
          encryption_public_key: toBase64(new Uint8Array(rawPublicKey)),
        });

        currentUserPublicKeyFromThisOnboardingSession = rawPublicKey;

        // TODO: should check encryptionSettings will update, otherwise hard refresh is needed
        window.location.reload();

        return;
      }

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

        // if the onboarding has been done directly in this encryption flow, the backend has not yet told the frontend
        // about the current user key, so just patching the mapping with this new public key
        if (currentUserPublicKeyFromThisOnboardingSession) {
          usersPublicKeys[user.id] =
            currentUserPublicKeyFromThisOnboardingSession;
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
            <Text $size="sm" $variation="secondary">
              {t(
                'Encrypting a document ensures that only authorized members can read its content. Before proceeding, the following conditions must be met:',
              )}
            </Text>

            {/* TODO: warning about encryption */}
            {/* TODO: if no public key for current user, provide an onboarding */}

            <Box $gap="xs">
              <Box $direction="row" $align="center" $gap="xs">
                <Icon
                  iconName={isRestricted ? 'check_circle' : 'cancel'}
                  $size="sm"
                  $theme={isRestricted ? 'success' : 'danger'}
                />
                <Text $size="sm" $weight={isRestricted ? '400' : '600'}>
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
                  $theme={!hasPendingInvitations ? 'success' : 'danger'}
                />
                <Text
                  $size="sm"
                  $weight={!hasPendingInvitations ? '400' : '600'}
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
                      membersWithoutKey.length === 0 ? 'success' : 'danger'
                    }
                  />
                  <Text
                    $size="sm"
                    $weight={membersWithoutKey.length === 0 ? '400' : '600'}
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

            {!canEncrypt && (
              <Text $size="xs" $variation="secondary">
                {t(
                  'Please resolve the issues above before encrypting the document.',
                )}
              </Text>
            )}
          </Box>
        )}

        {isError && <TextErrors causes={error.cause} />}
      </Box>
    </Modal>
  );
};
