import { openDB } from 'idb';
import { useEffect } from 'react';

import { useCollaborationUrl } from '@/core/config';
import { decryptContent } from '@/docs/doc-collaboration/encryption';
import { Base64, useProviderStore } from '@/docs/doc-management';
import { useAuth } from '@/features/auth';
import { useBroadcastStore } from '@/stores';

export const useCollaboration = (
  room?: string,
  initialContent?: Base64,
  isEncrypted?: boolean,
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
      [
        typeof initialDocState,
        (
          | {
              symmetricKey: CryptoKey;
            }
          | undefined
        ),
      ]
    >;

    if (isEncrypted) {
      contentPromise = (async () => {
        // We must first retrieve user keys locally to decode the document symmetric key
        const encryptionDatabase = await openDB('encryption');

        const userPrivateKey = await encryptionDatabase.get(
          'privateKey',
          `user:${user.id}`,
        );

        if (!userPrivateKey) {
          throw new Error(
            'should display specific components about not having encryption set up locally, probably show an onboarding cta, and probably this should be retrieve at a higher component level',
          );
        }

        // TODO:
        // TODO: should retrieve doc access encrypted symkey for this user
        // TODO: from the use of `useCollaboration(doc?.id, doc?.content, doc?.is_encrypted);`
        // TODO:
        const encryptionSettings = {
          symmetricKey: xxx,
        };

        if (initialDocState) {
          return [
            Buffer.from(
              await decryptContent(
                initialDocState,
                encryptionSettings.symmetricKey,
              ),
            ),
            encryptionSettings,
          ];
        } else {
          return [initialDocState, encryptionSettings];
        }
      })();
    } else {
      contentPromise = Promise.resolve([initialDocState, undefined]);
    }

    contentPromise.then(([initialDocState, encryptionSettings]) => {
      const newProvider = createProvider(
        collaborationUrl,
        room,
        initialDocState,
        encryptionSettings,
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
