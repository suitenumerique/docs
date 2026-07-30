import { useEffect } from 'react';

import { useCollaborationUrl } from '@/core/config';
import { DocumentEncryptionSettings } from '@/docs/doc-collaboration/hook/useDocumentEncryption';
import { Base64, useProviderStore } from '@/docs/doc-management';
import { useAuth } from '@/features/auth';
import { useVaultClient } from '@/features/docs/doc-collaboration/vault';
import { useBroadcastStore } from '@/stores';

export const useCollaboration = (
  room: string | undefined,
  initialContent: Base64 | undefined,
  isEncrypted: boolean | undefined,
  documentEncryptionSettings: DocumentEncryptionSettings | null,
) => {
  const collaborationUrl = useCollaborationUrl(room);
  const { setBroadcastProvider, cleanupBroadcast } = useBroadcastStore();
  const { user } = useAuth();
  const { client: vaultClient } = useVaultClient();
  const { provider, createProvider, destroyProvider, encryptionTransition } =
    useProviderStore();

  useEffect(() => {
    if (
      !room ||
      !collaborationUrl ||
      !user ||
      isEncrypted === undefined ||
      (isEncrypted === true && !documentEncryptionSettings) ||
      (isEncrypted === true && !vaultClient) ||
      provider ||
      encryptionTransition
    ) {
      return;
    }

    const initialDocState = initialContent
      ? Buffer.from(initialContent, 'base64')
      : undefined;

    if (isEncrypted && documentEncryptionSettings && vaultClient) {
      (async () => {
        let decryptedState = initialDocState;

        if (initialDocState) {
          // Decrypt initial document content via vault — pure ArrayBuffer
          const { data: decryptedBuffer } = await vaultClient.decryptWithKey(
            initialDocState.buffer,
            documentEncryptionSettings.encryptedSymmetricKey,
            documentEncryptionSettings.keyVersion,
          );

          decryptedState = Buffer.from(decryptedBuffer);
        }

        const newProvider = createProvider(
          collaborationUrl,
          room,
          decryptedState,
          {
            vaultClient,
            encryptedSymmetricKey:
              documentEncryptionSettings.encryptedSymmetricKey,
            keyVersion: documentEncryptionSettings.keyVersion,
          },
        );

        setBroadcastProvider(newProvider);
      })().catch((err) => {
        console.error('Failed to decrypt document content:', err);
      });
    } else {
      const newProvider = createProvider(
        collaborationUrl,
        room,
        initialDocState,
      );

      setBroadcastProvider(newProvider);
    }
  }, [
    provider,
    collaborationUrl,
    room,
    initialContent,
    createProvider,
    setBroadcastProvider,
    user,
    isEncrypted,
    documentEncryptionSettings,
    vaultClient,
    encryptionTransition,
  ]);

  useEffect(() => {
    return () => {
      if (room) {
        cleanupBroadcast();
        destroyProvider();
      }
    };
  }, [destroyProvider, room, cleanupBroadcast]);
};
