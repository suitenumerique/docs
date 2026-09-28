import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { APIError, errorCauses, fetchAPI } from '@/api';
import type { DocumentEncryptionSettings } from '@/docs/doc-collaboration/hook/useDocumentEncryption';
import { Access, Doc, KEY_DOC, KEY_LIST_DOC } from '@/docs/doc-management';
import { fetchRegisteredKeys } from '@/features/docs/doc-collaboration/vault';
import { toBase64 } from '@/features/docs/doc-editor';

import { KEY_LIST_DOC_ACCESSES } from './useDocAccesses';

interface AcceptEncryptionAccessParams {
  docId: Doc['id'];
  accessId: string;
  encrypted_document_symmetric_key_for_user: string;
  encryption_public_key_version: number;
}

/**
 * PATCH /api/v1.0/documents/{docId}/accesses/{accessId}/encryption-key/
 *
 * "Accept" a pending collaborator — the caller (who already holds a
 * wrapped symmetric key on the document) re-wraps it for a user whose
 * access row was created pending (they had no public key at invite
 * time). Flips `encrypted_document_symmetric_key_for_user` from NULL
 * to the supplied wrapped key and stores the current key version.
 */
export const acceptEncryptionAccess = async ({
  docId,
  accessId,
  encrypted_document_symmetric_key_for_user,
  encryption_public_key_version,
}: AcceptEncryptionAccessParams): Promise<void> => {
  const response = await fetchAPI(
    `documents/${docId}/accesses/${accessId}/encryption-key/`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        encrypted_document_symmetric_key_for_user,
        encryption_public_key_version,
      }),
    },
  );

  if (!response.ok) {
    throw new APIError(
      'Failed to accept the pending collaborator.',
      await errorCauses(response),
    );
  }
};

/**
 * Give pending members the document key: those who have enabled encryption
 * since they were added get it wrapped for their current key, in one vault
 * call (so one verification prompt for every recipient not yet trusted), and
 * the others stay pending. Throws when the vault refuses the wrap, e.g. when
 * the caller declines to verify a recipient: nobody is accepted then.
 */
export const acceptPendingMembers = async (
  vaultClient: VaultClient,
  docId: Doc['id'],
  settings: DocumentEncryptionSettings,
  pending: Access[],
): Promise<{ accepted: Access[]; notReady: Access[] }> => {
  const members = pending.flatMap((access) =>
    access.user?.suite_user_id
      ? [{ access, sub: access.user.suite_user_id }]
      : [],
  );
  const { publicKeys, versions } = await fetchRegisteredKeys(
    vaultClient,
    members.map(({ sub }) => sub),
  );
  const ready = members.filter(({ sub }) => !!publicKeys[sub]);
  const notReady = pending.filter(
    (access) => !ready.some((member) => member.access === access),
  );

  if (ready.length === 0) {
    return { accepted: [], notReady };
  }

  // The vault resolves and trust-checks each recipient key (binding + TOFU);
  // the labels are display-only, shown if the verification prompt opens.
  const recipients: Record<string, RecipientLabel> = {};
  for (const { access, sub } of ready) {
    recipients[sub] = { email: access.user.email, name: access.user.full_name };
  }
  const { encryptedKeys } = await vaultClient.shareKeys(
    settings.encryptedSymmetricKey,
    recipients,
  );

  const accepted: Access[] = [];
  for (const { access, sub } of ready) {
    const wrappedKey = encryptedKeys[sub];
    if (!wrappedKey) {
      continue;
    }
    await acceptEncryptionAccess({
      docId,
      accessId: access.id,
      encrypted_document_symmetric_key_for_user: toBase64(
        new Uint8Array(wrappedKey),
      ),
      encryption_public_key_version: versions[sub],
    });
    accepted.push(access);
  }

  return { accepted, notReady };
};

export function useAcceptPendingMembers() {
  const queryClient = useQueryClient();

  return useCallback(
    async (
      vaultClient: VaultClient,
      docId: Doc['id'],
      settings: DocumentEncryptionSettings,
      pending: Access[],
    ) => {
      try {
        return await acceptPendingMembers(
          vaultClient,
          docId,
          settings,
          pending,
        );
      } finally {
        void queryClient.invalidateQueries({
          queryKey: [KEY_LIST_DOC_ACCESSES, { docId }],
        });
        void queryClient.invalidateQueries({
          queryKey: [KEY_DOC, { id: docId }],
        });
        void queryClient.invalidateQueries({
          queryKey: [KEY_LIST_DOC],
        });
      }
    },
    [queryClient],
  );
}
