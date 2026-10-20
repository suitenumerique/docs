import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import type { DocumentEncryptionSettings } from '@/docs/doc-collaboration/hook/useDocumentEncryption';
import { Doc, KEY_DOC, updateMaintenanceKey } from '@/docs/doc-management';
import { useVaultClient } from '@/features/docs/doc-collaboration/vault';

// Documents already tried in this tab: a deployment without the maintenance
// escrow never returns a copy, and the vault must not be asked again on every
// render.
const attempted = new Set<string>();

/**
 * When someone who can edit an encrypted document opens it and it has no
 * maintenance copy (encrypted before the deployment escrowed, before a key
 * covered its owner's organization, or by someone other than its creator, whose
 * copy the backend does not keep), ask the vault for one, for the creator's
 * organization, and store it. Silent: the document opens the same either way.
 */
export const useMaintenanceKeyBackfill = (
  doc: Doc | undefined,
  settings: DocumentEncryptionSettings | null,
) => {
  const { client: vaultClient } = useVaultClient();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (
      !doc?.is_encrypted ||
      doc.has_maintenance_key !== false ||
      !doc.abilities.maintenance_key ||
      // Without the creator, the vault would take the caller as the owner and
      // make a copy for the caller's organization.
      !doc.creator_sub ||
      !settings ||
      !vaultClient ||
      attempted.has(doc.id)
    ) {
      return;
    }
    attempted.add(doc.id);

    const docId = doc.id;
    const creatorSub = doc.creator_sub;
    // No recipients: the vault returns only the maintenance copy.
    vaultClient
      .shareKeys(settings.encryptedSymmetricKey, {}, undefined, creatorSub)
      .then(async ({ maintenanceKey }) => {
        if (!maintenanceKey) {
          return;
        }
        await updateMaintenanceKey({ docId, maintenanceKey });
        void queryClient.invalidateQueries({
          queryKey: [KEY_DOC, { id: docId }],
        });
      })
      .catch((err: unknown) => {
        console.warn('Could not backfill the maintenance key:', err);
      });
  }, [doc, settings, vaultClient, queryClient]);
};
