import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';

import { useCollaborationUrl } from '@/core/config';
import { useBroadcastStore } from '@/stores';

import { syncDocPolling } from '../api/syncDocPolling';
import { useProviderStore } from '../stores/useProviderStore';
import { Base64 } from '../types';
import { base64ToYDoc, toBase64 } from '../utils';

export const useCollaboration = (room?: string, initialContent?: Base64) => {
  const collaborationUrl = useCollaborationUrl(room);
  const { setBroadcastProvider } = useBroadcastStore();
  const { provider, createProvider, destroyProvider, isProviderFailure } =
    useProviderStore();
  const [pollingInterval, setPollingInterval] = useState(1500);
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!room || !collaborationUrl?.wsUrl || provider) {
      return;
    }

    const newProvider = createProvider(
      collaborationUrl.wsUrl,
      room,
      initialContent,
    );
    setBroadcastProvider(newProvider);
  }, [
    provider,
    collaborationUrl?.wsUrl,
    room,
    initialContent,
    createProvider,
    setBroadcastProvider,
  ]);

  /**
   * Polling to sync the document
   * This is a fallback mechanism in case the WebSocket connection fails
   */
  useEffect(() => {
    const clearCurrentInterval = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    };

    if (!isProviderFailure && intervalRef.current) {
      clearCurrentInterval();
    }

    if (
      !isProviderFailure ||
      !collaborationUrl?.pollUrl ||
      intervalRef.current ||
      !provider?.document
    ) {
      return;
    }

    intervalRef.current = setInterval(() => {
      syncDocPolling({
        pollUrl: collaborationUrl.pollUrl,
        yDoc64: toBase64(Y.encodeStateAsUpdate(provider.document)),
      })
        .then((response) => {
          const { yDoc64, connectionsCount } = response;

          setPollingInterval(connectionsCount ? 600 : 1500);

          if (!yDoc64) {
            return;
          }

          const yDoc = base64ToYDoc(yDoc64);
          Y.applyUpdate(provider.document, Y.encodeStateAsUpdate(yDoc));
        })
        .catch((error) => {
          console.error('Polling failed:', error);
        });
    }, pollingInterval);

    return () => {
      clearCurrentInterval();
    };
  }, [
    collaborationUrl?.pollUrl,
    isProviderFailure,
    pollingInterval,
    provider?.document,
  ]);

  useEffect(() => {
    return () => {
      if (room) {
        destroyProvider();
      }
    };
  }, [destroyProvider, room]);
};
