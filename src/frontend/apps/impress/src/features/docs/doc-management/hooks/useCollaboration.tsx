import { useEffect } from 'react';

import { useCollaborationUrl } from '@/core/config';
import { decrypt } from '@/docs/doc-collaboration/encryption';
import { Base64, useProviderStore } from '@/docs/doc-management';
import { useBroadcastStore } from '@/stores';

export const useCollaboration = (
  room?: string,
  initialContent?: Base64,
  isEncrypted?: boolean,
) => {
  const collaborationUrl = useCollaborationUrl(room);
  const { setBroadcastProvider, cleanupBroadcast } = useBroadcastStore();
  const { provider, createProvider, destroyProvider } = useProviderStore();

  useEffect(() => {
    if (!room || !collaborationUrl || isEncrypted === undefined || provider) {
      return;
    }

    // Since that's initially binary it has been wrapped as base64 first
    let initialDocState = initialContent
      ? Buffer.from(initialContent, 'base64')
      : undefined;

    // If the document is marked as encrypted we need an extra decoding to retrieve the Yjs state
    if (initialDocState && isEncrypted) {
      initialDocState = Buffer.from(decrypt(initialDocState));
    }

    const newProvider = createProvider(
      collaborationUrl,
      room,
      isEncrypted,
      initialDocState,
    );
    setBroadcastProvider(newProvider);
  }, [
    provider,
    collaborationUrl,
    room,
    initialContent,
    createProvider,
    setBroadcastProvider,
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
