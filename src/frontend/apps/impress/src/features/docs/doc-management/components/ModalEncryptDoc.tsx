import {
  Alert,
  Button,
  Modal,
  ModalSize,
  Spinner,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/ui-components';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Y from 'yjs';

import { TextErrors } from '@/components';
import { useUserEncryption } from '@/docs/doc-collaboration';
import { useAuth } from '@/features/auth';
import {
  fetchRegisteredKeys,
  useVaultClient,
} from '@/features/docs/doc-collaboration/vault';
import {
  Doc,
  EncryptionTransitionEvent,
  KEY_DOC,
  KEY_LIST_DOC,
  LinkReach,
  getDocLinkReach,
  useEncryptDoc,
  useProviderStore,
} from '@/features/docs/doc-management';
import { useDocAccesses } from '@/features/docs/doc-share/api/useDocAccesses';
import { useDocInvitations } from '@/features/docs/doc-share/api/useDocInvitations';
import { useKeyboardAction } from '@/hooks';
import { toBase64 } from '@/utils/string';

import { countAnalyzingUploads, encryptDocContent } from '../encryptDocContent';

import { EncryptionModalContent } from './EncryptionLayout';

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
  // Invitees have no account yet: their invitation becomes a pending access
  // when they sign up, like a member without encryption.
  const invitationCount = invitationsData?.count ?? 0;

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

  const pendingCount = othersWithoutKey.length + invitationCount;

  const hasEncryptionKeys = !!encryptionSettings;

  // Members with no public key will be written to the backend as
  // pending (`null` wrapped key). They'll see the document in their
  // listings but won't be able to decrypt until the owner, opening the
  // document, gives them its key. This no longer blocks
  // encryption — only the degenerate case where NOBODY has a key does.
  const hasAnyPublicKey =
    accesses === undefined || accesses.length === 0
      ? true
      : accesses.some(
          (a) => a.user?.suite_user_id && !!publicKeysMap[a.user.suite_user_id],
        );

  // Followed live: a scan that ends while the modal is open unblocks it.
  const [analyzingUploads, setAnalyzingUploads] = useState(0);
  useEffect(() => {
    const yDoc = provider?.document;

    if (!yDoc) {
      return;
    }

    const update = () => setAnalyzingUploads(countAnalyzingUploads(yDoc));
    update();
    yDoc.on('update', update);

    return () => {
      yDoc.off('update', update);
    };
  }, [provider]);

  const canEncrypt =
    hasEncryptionKeys &&
    isRestricted &&
    hasAnyPublicKey &&
    analyzingUploads === 0;

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

      // Pass a labeled recipient map (sub → {email, name}) for every member
      // that has a published key: the vault resolves + trust-checks each key
      // itself (binding + TOFU) before wrapping, and the labels are
      // display-only, surfaced if the trust modal needs a decision. Emails are
      // joined back from `accesses` (publicKeysMap only carries sub → key).
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

      const {
        encryptedContent,
        encryptedKeys,
        maintenanceKey,
        attachmentKeyMapping,
      } = await encryptDocContent({
        yDoc: ongoingDoc,
        docId: doc.id,
        vaultClient,
        recipients,
        currentUserSub: user.suite_user_id,
      });
      ongoingDoc.destroy();

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

      await encryptDoc({
        docId: doc.id,
        content: encryptedContent,
        encryptedSymmetricKeyPerUser,
        encryptionPublicKeyVersionPerUser,
        attachmentKeyMapping,
        // Made for the caller's organization: the backend keeps it only from
        // the creator, and the backfill makes the creator's otherwise.
        maintenanceKey: maintenanceKey
          ? toBase64(new Uint8Array(maintenanceKey))
          : null,
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
  if (analyzingUploads > 0) {
    blockers.push(
      t(
        'Some files are still being analyzed by the antivirus: wait for the analysis to finish',
      ),
    );
  }
  if (!isRestricted) {
    blockers.push(
      t('Document must be set to private (currently {{reach}})', {
        reach:
          effectiveReach === LinkReach.PUBLIC ? t('public') : t('connected'),
      }),
    );
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

        {!isError && blockers.length === 0 && pendingCount > 0 && (
          <Alert type={VariantType.WARNING}>
            {t(
              '{{count}} collaborators have not enabled encryption yet. They will be added as pending and get access once they enable it.',
              { count: pendingCount },
            )}
          </Alert>
        )}

        {isError && <TextErrors causes={error.cause} />}
      </EncryptionModalContent>
    </Modal>
  );
};
