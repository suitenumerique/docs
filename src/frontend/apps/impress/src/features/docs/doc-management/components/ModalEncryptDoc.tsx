import {
  Alert,
  Button,
  Modal,
  ModalSize,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/cunningham-react';
import { Spinner } from '@gouvfr-lasuite/ui-kit';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Y from 'yjs';

import { TextErrors } from '@/components';
import { useUserEncryption } from '@/docs/doc-collaboration';
import { createDocAttachment } from '@/docs/doc-editor/api';
import { useAuth } from '@/features/auth';
import {
  fetchRegisteredKeys,
  useVaultClient,
} from '@/features/docs/doc-collaboration/vault';
import { toBase64 } from '@/features/docs/doc-editor';
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

import { EncryptionModalContent } from './EncryptionLayout';

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
  const [publicKeysMap, setPublicKeysMap] = useState<
    Record<string, ArrayBuffer>
  >({});
  const [keyVersionsMap, setKeyVersionsMap] = useState<Record<string, number>>(
    {},
  );

  useEffect(() => {
    if (!accesses || !vaultClient) {
      return;
    }

    const userIds = accesses
      .filter((a) => a.user?.suite_user_id)
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      .map((a) => a.user.suite_user_id!);

    if (userIds.length === 0) {
      return;
    }

    fetchRegisteredKeys(vaultClient, userIds)
      .then(({ publicKeys, versions }) => {
        setPublicKeysMap(publicKeys);
        setKeyVersionsMap(versions);
      })
      .catch(() => {});
  }, [accesses, vaultClient]);

  const membersWithoutKey = useMemo(() => {
    if (!accesses) {
      return [];
    }

    return accesses.filter(
      (access) =>
        access.user?.suite_user_id && !publicKeysMap[access.user.suite_user_id],
    );
  }, [accesses, publicKeysMap]);

  // The current user is the one performing the encryption — never surface them
  // in the "haven't completed onboarding" summary, even if their own key has
  // not yet propagated to the directory. The backend write path still relies on
  // `membersWithoutKey` above.
  const othersWithoutKey = useMemo(
    () =>
      membersWithoutKey.filter(
        (access) => access.user?.suite_user_id !== user?.suite_user_id,
      ),
    [membersWithoutKey, user?.suite_user_id],
  );

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
          (a) => a.user?.suite_user_id && !!publicKeysMap[a.user.suite_user_id],
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
    if (
      !provider ||
      !user ||
      isPending ||
      !canEncrypt ||
      !encryptionSettings ||
      !vaultClient
    ) {
      return;
    }

    setIsPending(true);

    try {
      notifyOthers(EncryptionTransitionEvent.ENCRYPTION_STARTED);

      if (Object.keys(publicKeysMap).length === 0) {
        throw new Error(
          'No public keys available. All members must have encryption enabled.',
        );
      }

      // Clone the Yjs document for encryption
      const ongoingDoc = new Y.Doc();
      Y.applyUpdate(ongoingDoc, Y.encodeStateAsUpdate(provider.document));

      const ongoingDocState = Y.encodeStateAsUpdate(ongoingDoc);

      // Encrypt document content via vault — pure ArrayBuffer. Pass a labeled
      // recipient map (sub → {email, name}) for every member that has a
      // published key: the vault resolves + trust-checks each key itself
      // (binding + TOFU) before wrapping, and the labels are display-only,
      // surfaced if the trust modal needs a decision. Emails are joined back
      // from `accesses` (publicKeysMap only carries sub → key).
      const recipients: Record<string, { email: string; name?: string }> = {};
      for (const access of accesses ?? []) {
        const sub = access.user?.suite_user_id;
        if (sub && publicKeysMap[sub]) {
          recipients[sub] = {
            email: access.user.email,
            name: access.user.full_name,
          };
        }
      }

      const { encryptedContent: encryptedContentBuffer, encryptedKeys } =
        await vaultClient.encryptWithoutKey(
          ongoingDocState.buffer as ArrayBuffer,
          recipients,
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

      // Matched version map — same set of users, same cardinality.
      // Stored on each DocumentAccess row so the key-mismatch panel can
      // later detect key rotation (current version !== stored version).
      const encryptionPublicKeyVersionPerUser: Record<string, number | null> =
        {};
      for (const uid of Object.keys(publicKeysMap)) {
        encryptionPublicKeyVersionPerUser[uid] = keyVersionsMap[uid] ?? null;
      }
      for (const access of membersWithoutKey) {
        const sub = access.user?.suite_user_id;
        if (sub && !(sub in encryptionPublicKeyVersionPerUser)) {
          encryptionPublicKeyVersionPerUser[sub] = null;
        }
      }

      // Get the current user's encrypted key for attachment encryption
      const currentUserEncryptedKey = user.suite_user_id
        ? encryptedKeys[user.suite_user_id]
        : undefined;

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
        encryptionPublicKeyVersionPerUser,
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

  // Only the conditions that are NOT met are worth a word: the modal describes
  // what encrypting does, and warns about what still blocks it.
  const blockers: string[] = [];
  if (!hasEncryptionKeys) {
    blockers.push(t('You must enable encryption from your account menu first'));
  }
  if (!isRestricted) {
    blockers.push(
      t('Document must be set to private (currently {{reach}})', {
        reach:
          effectiveReach === LinkReach.PUBLIC ? t('public') : t('connected'),
      }),
    );
  }
  if (hasPendingInvitations) {
    blockers.push(t('Pending invitations must be resolved first'));
  }

  return (
    <Modal
      isOpen
      closeOnClickOutside={!isPending}
      onClose={handleClose}
      size={ModalSize.SMALL}
      aria-label={t('Encrypt document')}
    >
      <EncryptionModalContent
        illustration="document-shield-check"
        title={t('Encrypt document')}
        titleId="modal-encrypt-doc-title"
        description={t(
          'The document and its attachments will be encrypted end-to-end. Only people you share it with will be able to access its contents.',
        )}
        actions={
          <>
            <Button
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
              {t('Encrypt')}
            </Button>
            <Button
              variant="bordered"
              color="neutral"
              fullWidth
              onClick={handleClose}
              onKeyDown={handleCloseKeyDown}
              disabled={isPending}
            >
              {t('Cancel')}
            </Button>
          </>
        }
      >
        {!isError && blockers.length > 0 && (
          <Alert type={VariantType.ERROR}>
            {blockers.length === 1 ? (
              blockers[0]
            ) : (
              <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                {blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            )}
          </Alert>
        )}

        {!isError && blockers.length === 0 && othersWithoutKey.length > 0 && (
          <Alert type={VariantType.WARNING}>
            {t(
              '{{count}} collaborator(s) have not enabled encryption yet. They will be added as pending and cannot open the document until someone accepts them from the share dialog.',
              { count: othersWithoutKey.length },
            )}
          </Alert>
        )}

        {isError && <TextErrors causes={error.cause} />}
      </EncryptionModalContent>
    </Modal>
  );
};
