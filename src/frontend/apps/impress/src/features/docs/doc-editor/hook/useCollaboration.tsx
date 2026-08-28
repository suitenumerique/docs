import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useCollaborationUrl, useConfig } from '@/core/config';
import { KEY_DOC } from '@/docs/doc-management/api/useDoc';
import { useProviderStore } from '@/docs/doc-management/stores/useProviderStore';
import { useIsOffline } from '@/features/service-worker/hooks/useOffline';
import { useBroadcastStore } from '@/stores/useBroadcastStore';

/**
 * `readOnly` is the editor's own predicate, and it reaches this far because the
 * providers are built with it: a reader publishes no presence, which the http
 * fallback can only express by carrying no awareness instance at all (see
 * `createProvider`). It is allowed to be stricter than the collaboration
 * server's own verdict — that direction only declines presence we would have
 * been permitted to send — but never looser.
 */
export const useCollaboration = (room: string, readOnly = false) => {
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
    isPermanentlyClosed,
    reconnect,
    pauseForInactivity,
    resumeFromInactivity,
  } = useProviderStore();
  const isOffline = useIsOffline((state) => state.isOffline);

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
   * The collaboration server refused the connection for good and the retry loop
   * stopped, so nothing will ask again on its own: this refetch is what asks.
   *
   * A refusal says the answer changed, not what it changed to. The document may
   * be gone, our access to it revoked, or merely upgraded from reader to editor
   * — the last one has to reconnect to carry the new rights. So the connection
   * comes back only when the document does, and stays closed otherwise, where
   * the query error puts the page in charge of telling the user why.
   */
  useEffect(() => {
    if (!isPermanentlyClosed || !room) {
      return;
    }

    void queryClient
      .invalidateQueries({ queryKey: [KEY_DOC, { id: room }] })
      .then(() => {
        if (
          queryClient.getQueryState([KEY_DOC, { id: room }])?.status ===
          'success'
        ) {
          reconnect();
        }
      });
  }, [isPermanentlyClosed, room, queryClient, reconnect]);

  /**
   * We add a broadcast task to reset the query cache
   * when the document visibility changes.
   */
  useEffect(() => {
    if (!room || broadcastProvider?.doc.guid !== room) {
      return;
    }

    addTask(`${KEY_DOC}-${room}`, () => {
      void queryClient.invalidateQueries({
        queryKey: [KEY_DOC, { id: room }],
      });
    });
  }, [addTask, room, queryClient, broadcastProvider?.doc.guid]);

  /**
   * Set the provider when the collaboration URL and the document content are available.
   */
  useEffect(() => {
    if (!room || !collaborationUrl || provider) {
      return;
    }

    const newProvider = createProvider(collaborationUrl, room, undefined, {
      readOnly,
    });
    setBroadcastProvider(newProvider);
  }, [
    provider,
    collaborationUrl,
    createProvider,
    room,
    readOnly,
    setBroadcastProvider,
  ]);

  /**
   * Rebuild the providers when the access changes under us.
   *
   * The effect above builds them once and `reconnect` only reopens the socket, so
   * the `readOnly` decision baked into the http fallback would otherwise outlive
   * the access it was made from. Demotion is the direction that bites: an editor
   * turned reader would keep an awareness-publishing fallback, whose first
   * `PATCH` takes a 403 and closes it for good. A permission change already
   * forces a full re-auth (the server closes with 4401, the document is
   * refetched, the connection is made again), so tearing the providers down here
   * is in keeping rather than an extra disruption — the document itself lives on
   * the server, and the editor re-renders from the fresh sync.
   */
  const builtReadOnly = useRef(readOnly);
  useEffect(() => {
    if (!provider || builtReadOnly.current === readOnly) {
      return;
    }
    builtReadOnly.current = readOnly;
    cleanupBroadcast();
    destroyProvider();
  }, [readOnly, provider, cleanupBroadcast, destroyProvider]);

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
