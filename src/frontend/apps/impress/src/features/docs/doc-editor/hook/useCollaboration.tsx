import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useCollaborationUrl, useConfig } from '@/core/config';
import { KEY_DOC } from '@/docs/doc-management/api/useDoc';
import {
  KEY_DOC_CONTENT,
  useDocContent,
} from '@/docs/doc-management/api/useDocContent';
import { useProviderStore } from '@/docs/doc-management/stores/useProviderStore';
import { useIsOffline } from '@/features/service-worker/hooks/useOffline';
import { useBroadcastStore } from '@/stores/useBroadcastStore';

export const useCollaboration = (room: string) => {
  const collaborationUrl = useCollaborationUrl(room);
  const { addTask } = useBroadcastStore();
  const queryClient = useQueryClient();
  const { data: config } = useConfig();
  const {
    setBroadcastProvider,
    cleanupBroadcast,
    provider: broadcastProvider,
  } = useBroadcastStore();
  const {
    provider,
    createProvider,
    destroyProvider,
    setReady,
    isReady,
    hasLostConnection,
    resetLostConnection,
    pauseForInactivity,
    resumeFromInactivity,
  } = useProviderStore();
  const isOffline = useIsOffline((state) => state.isOffline);
  const { data: docContent } = useDocContent(
    { id: room },
    {
      staleTime: 30000, // 30 seconds - We keep the data fresh as it is a highly collaborative page
      queryKey: [KEY_DOC_CONTENT, { id: room }],
    },
  );

  /**
   * When offline, the WebSocket never connects so the provider would stay
   * in a non-ready state for a long time. Immediately mark it as ready so
   * the editor can render with the cached content.
   */
  useEffect(() => {
    if (isOffline && provider && !isReady) {
      setReady(true);
    }
  }, [isOffline, isReady, provider, setReady]);

  /**
   * When the provider detects a lost connection, we invalidate the document query to trigger a refetch.
   * Because it can be because the user has access to the document that are modified
   * (e.g., permissions changed, document deleted, user removed)
   */
  useEffect(() => {
    if (hasLostConnection && room) {
      void queryClient.invalidateQueries({
        queryKey: [KEY_DOC, { id: room }],
      });
      resetLostConnection();
    }
  }, [hasLostConnection, room, queryClient, resetLostConnection]);

  /**
   * We add a broadcast task to reset the query cache
   * when the document visibility changes.
   */
  useEffect(() => {
    if (!room || broadcastProvider?.document?.guid !== room) {
      return;
    }

    addTask(`${KEY_DOC}-${room}`, () => {
      void queryClient.invalidateQueries({
        queryKey: [KEY_DOC, { id: room }],
      });
    });
  }, [addTask, room, queryClient, broadcastProvider?.document?.guid]);

  /**
   * Set the provider when the collaboration URL and the document content are available.
   */
  useEffect(() => {
    if (!room || !collaborationUrl || provider || docContent === undefined) {
      return;
    }

    const newProvider = createProvider(collaborationUrl, room, docContent);
    setBroadcastProvider(newProvider);
  }, [
    provider,
    collaborationUrl,
    createProvider,
    docContent,
    room,
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

  useEffect(() => {
    if (!provider || !config?.COLLABORATION_WS_INACTIVITY_TIMEOUT) {
      return;
    }

    const timeoutMs = config.COLLABORATION_WS_INACTIVITY_TIMEOUT * 1000;
    let inactivityTimeout: ReturnType<typeof setTimeout> | undefined;

    const startInactivityTimer = () => {
      clearTimeout(inactivityTimeout);
      inactivityTimeout = setTimeout(pauseForInactivity, timeoutMs);
    };

    if (document.hidden) {
      startInactivityTimer();
    }

    const visibilityChangeHandler = () => {
      if (document.hidden) {
        startInactivityTimer();
      } else {
        clearTimeout(inactivityTimeout);
        resumeFromInactivity();
      }
    };

    document.addEventListener('visibilitychange', visibilityChangeHandler);

    return () => {
      document.removeEventListener('visibilitychange', visibilityChangeHandler);
      clearTimeout(inactivityTimeout);
    };
  }, [
    pauseForInactivity,
    provider,
    resumeFromInactivity,
    config?.COLLABORATION_WS_INACTIVITY_TIMEOUT,
  ]);
};
