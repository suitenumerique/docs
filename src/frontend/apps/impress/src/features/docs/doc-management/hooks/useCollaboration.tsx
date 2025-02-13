import { useEffect } from 'react';

import { useCollaborationUrl } from '@/core/config';
import { useBroadcastStore } from '@/stores';

import { useProviderStore } from '../stores/useProviderStore';
import { Base64 } from '../types';

export const useCollaboration = (
  room?: string,
  initialContent?: Base64,
  canEdit?: boolean,
) => {
  const collaborationUrl = useCollaborationUrl(room);
  const { setBroadcastProvider } = useBroadcastStore();
  const { provider, createProvider, destroyProvider } = useProviderStore();

  /**
   * Initialize the provider
   */
  useEffect(() => {
    if (!room || !collaborationUrl || provider || canEdit === undefined) {
      return;
    }

    const newProvider = createProvider(
      collaborationUrl,
      room,
      canEdit,
      initialContent,
    );
    setBroadcastProvider(newProvider);
  }, [
    provider,
    collaborationUrl,
    room,
    initialContent,
    createProvider,
    setBroadcastProvider,
    canEdit,
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
