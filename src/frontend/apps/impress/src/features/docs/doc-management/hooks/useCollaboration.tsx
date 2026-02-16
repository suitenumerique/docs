import { openDB } from 'idb';
import { useEffect } from 'react';

import { useCollaborationUrl } from '@/core/config';
import {
  decryptContent,
  decryptSymmetricKey,
} from '@/docs/doc-collaboration/encryption';
import { Base64, useProviderStore } from '@/docs/doc-management';
import { useAuth } from '@/features/auth';
import { useBroadcastStore } from '@/stores';

export const useCollaboration = (
  room: string | undefined,
  initialContent: Base64 | undefined,
  isEncrypted: boolean | undefined,
  userEncryptedSymmetricKey: string | undefined,
  encryptionSettings: {
    userPrivateKey: CryptoKey;
    userPublicKey: CryptoKey;
  } | null,
) => {
  const collaborationUrl = useCollaborationUrl(room);
  const { setBroadcastProvider, cleanupBroadcast } = useBroadcastStore();
  const { user } = useAuth();
  const { provider, createProvider, destroyProvider } = useProviderStore();

  useEffect(() => {
    if (
      !room ||
      !collaborationUrl ||
      !user ||
      isEncrypted === undefined ||
      (isEncrypted === true &&
        !userEncryptedSymmetricKey &&
        !encryptionSettings) ||
      provider
    ) {
      // TODO: make sure the logout would invalide this provider, also a change of local keys (after import...)
      return;
    }

    // since that's initially binary it has been wrapped as base64 first
    let initialDocState = initialContent
      ? Buffer.from(initialContent, 'base64')
      : undefined;

    // if the document is marked as encrypted we need an extra decoding to retrieve the Yjs state
    // note: we hack a bit due to decryption being async
    let contentPromise: Promise<
      [typeof initialDocState, CryptoKey | undefined]
    >;

    if (isEncrypted) {
      contentPromise = (async () => {
        if (!userEncryptedSymmetricKey) {
          throw new Error(
            `"encrypted_document_symmetric_key_for_user" must be provided since document is encrypted`,
          );
        }

        const symmetricKey = await decryptSymmetricKey(
          userEncryptedSymmetricKey,
          encryptionSettings!.userPrivateKey,
        );

        if (initialDocState) {
          return [
            Buffer.from(await decryptContent(initialDocState, symmetricKey)),
            symmetricKey,
          ];
        } else {
          return [initialDocState, symmetricKey];
        }
      })();
    } else {
      contentPromise = Promise.resolve([initialDocState, undefined]);
    }

    contentPromise.then(([initialDocState, symmetricKey]) => {
      const newProvider = createProvider(
        collaborationUrl,
        room,
        initialDocState,
        symmetricKey,
      );

      setBroadcastProvider(newProvider);
    });
  }, [
    provider,
    collaborationUrl,
    room,
    initialContent,
    createProvider,
    setBroadcastProvider,
    user,
  ]);

  /**
   * Destroy the provider when the component is unmounted
   */
  useEffect(() => {
    return () => {
      if (room) {
        cleanupBroadcast();
        destroyProvider();
      }
    };
  }, [destroyProvider, room, cleanupBroadcast]);
};
