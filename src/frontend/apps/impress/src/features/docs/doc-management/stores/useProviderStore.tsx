import { CloseEvent } from '@hocuspocus/common';
import { HocuspocusProvider, WebSocketStatus } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { create } from 'zustand';

import { Base64 } from '@/docs/doc-management';

export interface UseCollaborationStore {
  createProvider: (
    providerUrl: string,
    storeId: string,
    initialDoc?: Base64,
  ) => HocuspocusProvider;
  destroyProvider: () => void;
  setReady: (value: boolean) => void;
  pauseForInactivity: () => void;
  resumeFromInactivity: () => void;
  provider: HocuspocusProvider | undefined;
  isConnected: boolean;
  isReady: boolean;
  isSynced: boolean;
  hasLostConnection: boolean;
  isPausedForInactivity: boolean;
  resetLostConnection: () => void;
}

const defaultValues = {
  provider: undefined,
  isConnected: false,
  isReady: false,
  isSynced: false,
  hasLostConnection: false,
  isPausedForInactivity: false,
};

type ExtendedCloseEvent = CloseEvent & { wasClean: boolean };

/**
 * When a massive simultaneous disconnection occurs (e.g. infra restart), all
 * clients would reconnect and invalidate their queries at exactly the same
 * time, causing a possible DB spike. Adding random jitter spreads these events over a
 * time window so the load is absorbed gradually.
 */
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_JITTER_MAX_MS = 3000;

let reconnectTimeout: ReturnType<typeof setTimeout> | undefined;
let lostConnectionTimeout: ReturnType<typeof setTimeout> | undefined;

export const useProviderStore = create<UseCollaborationStore>((set, get) => ({
  ...defaultValues,
  createProvider: (wsUrl, storeId, initialDoc) => {
    const doc = new Y.Doc({
      guid: storeId,
    });

    if (initialDoc) {
      Y.applyUpdate(doc, Buffer.from(initialDoc, 'base64'));
    }

    const provider = new HocuspocusProvider({
      url: wsUrl,
      name: storeId,
      document: doc,
      onDisconnect(data) {
        // Skip reconnect when the disconnect was triggered by inactivity:
        // reconnection only happens once the user becomes active again.
        if (get().isPausedForInactivity) {
          return;
        }

        // Attempt to reconnect if the disconnection was clean (initiated by the client or server)
        if ((data.event as ExtendedCloseEvent).wasClean) {
          if (data.event.reason === 'No cookies' && data.event.code === 4001) {
            console.error(
              'Disconnection due to missing cookies. Not attempting to reconnect.',
            );
            void provider.disconnect();
            set({
              isReady: true,
              isConnected: false,
            });
            return;
          }

          clearTimeout(reconnectTimeout);

          // Jitter spreading for reconnection attempts
          // Math.random() generates a random delay to avoid all clients
          // reconnecting at the same time
          reconnectTimeout = setTimeout(
            () => void provider.connect(),
            RECONNECT_BASE_DELAY_MS + Math.random() * RECONNECT_JITTER_MAX_MS,
          );
        }
      },
      onAuthenticationFailed() {
        set({ isReady: true, isConnected: false });
      },
      onAuthenticated() {
        set({ isReady: true, isConnected: true });
      },
      onStatus: ({ status }) => {
        const isConnected = status === WebSocketStatus.Connected;
        const wasConnected = get().isConnected;

        if (isConnected) {
          clearTimeout(lostConnectionTimeout);
        }
        // If we were previously connected and now we're not,
        // we might have lost the connection
        else if (wasConnected && !get().isPausedForInactivity) {
          clearTimeout(lostConnectionTimeout);
          // Jitter spreading for reconnection attempts
          // Math.random() generates a random delay to avoid all clients
          // reconnecting at the same time
          lostConnectionTimeout = setTimeout(
            () => set({ hasLostConnection: true }),
            Math.random() * RECONNECT_JITTER_MAX_MS,
          );
        }

        set((state) => {
          /**
           * status === WebSocketStatus.Connected does not mean we are totally connected
           * because authentication can still be in progress and failed
           * So we only update isConnected when we lose the connection
           */
          const connected =
            status !== WebSocketStatus.Connected
              ? {
                  isConnected: false,
                }
              : undefined;

          return {
            ...connected,
            isReady: state.isReady || status === WebSocketStatus.Disconnected,
          };
        });
      },
      onSynced: ({ state }) => {
        set({ isSynced: state, isReady: true });
      },
      onClose(data) {
        /**
         * Handle the "Reset Connection" event from the server
         * This is triggered when the server wants to reset the connection
         * for clients in the room.
         * A disconnect is made automatically but it takes time to be triggered,
         * so we force the disconnection here.
         */
        if (data.event.code === 1000) {
          provider.disconnect();
        }
      },
    });

    set({
      provider,
    });

    return provider;
  },
  destroyProvider: () => {
    clearTimeout(reconnectTimeout);
    clearTimeout(lostConnectionTimeout);
    const provider = get().provider;
    if (provider) {
      provider.destroy();
    }

    set(defaultValues);
  },
  setReady: (value: boolean) => set({ isReady: value }),
  pauseForInactivity: () => {
    if (get().isPausedForInactivity) {
      return;
    }
    clearTimeout(reconnectTimeout);
    clearTimeout(lostConnectionTimeout);
    set({ isPausedForInactivity: true, hasLostConnection: false });
    get().provider?.disconnect();
  },
  resumeFromInactivity: () => {
    if (!get().isPausedForInactivity) {
      return;
    }
    clearTimeout(lostConnectionTimeout);
    set({ isPausedForInactivity: false });
    void get().provider?.connect();
  },
  resetLostConnection: () => set({ hasLostConnection: false }),
}));
