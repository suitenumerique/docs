import { useEffect } from 'react';

import type { DocumentEncryptionSettings } from '@/docs/doc-collaboration/hook/useDocumentEncryption';
import type { Doc } from '@/docs/doc-management';
import { useVaultClient } from '@/features/docs/doc-collaboration/vault';

import {
  KEY_LIST_DOC_ACCESSES,
  useAcceptPendingMembers,
  useDocAccesses,
} from '../api';

// Pending sets already tried in this tab, per document: a declined
// verification prompt must not come back each time the page re-renders or the
// document is reopened. The share dialog keeps a manual Accept per member.
const attempted = new Set<string>();

/**
 * When someone who can manage members opens an encrypted document they can
 * read, give its key to every pending member who has enabled encryption since
 * they were added. Without this a pending member waits for someone to open
 * the share dialog and click Accept.
 */
export const useAutoAcceptPendingMembers = (
  doc: Doc | undefined,
  settings: DocumentEncryptionSettings | null,
) => {
  const { client: vaultClient } = useVaultClient();
  const acceptPendingMembers = useAcceptPendingMembers();
  const enabled =
    !!doc?.is_encrypted && !!doc.abilities.accesses_manage && !!settings;
  const docId = doc?.id ?? '';
  const { data: accesses } = useDocAccesses(
    { docId },
    { queryKey: [KEY_LIST_DOC_ACCESSES, { docId }], enabled },
  );

  useEffect(() => {
    if (!enabled || !doc || !settings || !vaultClient || !accesses) {
      return;
    }
    const pending = accesses.filter(
      (access) => access.is_pending_encryption && access.document.id === doc.id,
    );
    const key = `${doc.id}:${pending
      .map((access) => access.id)
      .sort()
      .join(',')}`;
    if (pending.length === 0 || attempted.has(key)) {
      return;
    }
    attempted.add(key);
    acceptPendingMembers(vaultClient, doc.id, settings, pending).catch(
      (err: unknown) => {
        console.warn('Could not give pending members the document key:', err);
      },
    );
  }, [enabled, doc, settings, vaultClient, accesses, acceptPendingMembers]);
};
