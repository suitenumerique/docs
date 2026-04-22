import { useMutation, useQueryClient } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { Doc, KEY_DOC, KEY_LIST_DOC } from '@/docs/doc-management';

import { KEY_LIST_DOC_ACCESSES } from './useDocAccesses';

interface AcceptEncryptionAccessParams {
  docId: Doc['id'];
  accessId: string;
  encrypted_document_symmetric_key_for_user: string;
  encryption_public_key_fingerprint: string;
}

/**
 * PATCH /api/v1.0/documents/{docId}/accesses/{accessId}/encryption-key/
 *
 * "Accept" a pending collaborator — the caller (who already holds a
 * wrapped symmetric key on the document) re-wraps it for a user whose
 * access row was created pending (they had no public key at invite
 * time). Flips `encrypted_document_symmetric_key_for_user` from NULL
 * to the supplied wrapped key and stores the current fingerprint.
 */
export const acceptEncryptionAccess = async ({
  docId,
  accessId,
  encrypted_document_symmetric_key_for_user,
  encryption_public_key_fingerprint,
}: AcceptEncryptionAccessParams): Promise<void> => {
  const response = await fetchAPI(
    `documents/${docId}/accesses/${accessId}/encryption-key/`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        encrypted_document_symmetric_key_for_user,
        encryption_public_key_fingerprint,
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

export function useAcceptEncryptionAccess() {
  const queryClient = useQueryClient();

  return useMutation<void, APIError, AcceptEncryptionAccessParams>({
    mutationFn: acceptEncryptionAccess,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [KEY_LIST_DOC_ACCESSES, { docId: variables.docId }],
      });
      void queryClient.invalidateQueries({
        queryKey: [KEY_DOC, { docId: variables.docId }],
      });
      void queryClient.invalidateQueries({
        queryKey: [KEY_LIST_DOC],
      });
    },
  });
}
