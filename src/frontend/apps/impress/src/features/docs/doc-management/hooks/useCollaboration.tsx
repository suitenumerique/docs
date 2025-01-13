import { useEffect } from 'react';

import { useCollaborationUrl } from '@/core/config';
import { useBroadcastStore } from '@/stores';

import { useProviderStore } from '../stores/useProviderStore';
import { Base64 } from '../types';

export const useCollaboration = (room?: string, initialContent?: Base64) => {
  const collaborationUrl = useCollaborationUrl(room);
  const { setBroadcastProvider } = useBroadcastStore();
  const { provider, createProvider, destroyProvider } = useProviderStore();

  useEffect(() => {
    if (!room || !collaborationUrl || provider) {
      return;
    }

    const newProvider = createProvider(collaborationUrl, room, initialContent);
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
        destroyProvider();
      }
    };
  }, [destroyProvider, room]);
};
