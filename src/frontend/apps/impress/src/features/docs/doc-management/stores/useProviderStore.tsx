import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { create } from 'zustand';

import { Base64 } from '@/docs/doc-management';

export interface UseCollaborationStore {
  createProvider: (
    serverUrl: string,
    storeId: string,
    initialDoc?: Base64,
  ) => WebsocketProvider;
  destroyProvider: () => void;
  setReady: (value: boolean) => void;
  pauseForInactivity: () => void;
  resumeFromInactivity: () => void;
  provider: WebsocketProvider | undefined;
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

/**
 * Close code sent by the collaboration server when Django resets the
 * connections of a room (permission change). The provider auto-reconnects
 * and re-authenticates against the gateway with its updated rights.
 */
const KICK_CLOSE_CODE = 4000;

/**
 * The gateway rejects unauthorized or WS-blocked connections at the HTTP
 * level, before the WebSocket handshake. After this many consecutive failed
 * attempts we mark the editor as ready so the user can work without
 * collaboration (direct Django save fallback) — but the provider keeps
 * retrying in the background (backoff capped at MAX_BACKOFF_TIME_MS), so a
 * transient outage such as a server deploy recovers automatically.
 */
const READY_WITHOUT_COLLAB_FAILURES = 3;

/**
 * Cap on y-websocket's exponential reconnect backoff. The default (2.5s)
 * would hammer a WS-blocked network forever; 30s keeps retries cheap while
 * still recovering from outages without a page reload.
 */
const MAX_BACKOFF_TIME_MS = 30000;

/**
 * When a massive simultaneous disconnection occurs (e.g. infra restart), all
 * clients would reconnect and invalidate their queries at exactly the same
 * time, causing a possible DB spike. Adding random jitter spreads these events over a
 * time window so the load is absorbed gradually.
 */
const RECONNECT_JITTER_MAX_MS = 3000;

let lostConnectionTimeout: ReturnType<typeof setTimeout> | undefined;

export const useProviderStore = create<UseCollaborationStore>((set, get) => ({
  ...defaultValues,
  createProvider: (serverUrl, storeId, initialDoc) => {
    const doc = new Y.Doc({
      guid: storeId,
    });

    if (initialDoc) {
      Y.applyUpdate(doc, Buffer.from(initialDoc, 'base64'));
    }

    const provider = new WebsocketProvider(serverUrl, storeId, doc, {
      // Cross-tab sync is handled by useBroadcastStore through the shared
      // Y.Doc tasks; the provider reconnection logic is enough here.
      disableBc: true,
      maxBackoffTime: MAX_BACKOFF_TIME_MS,
    });

    let consecutiveFailures = 0;

    provider.on('status', ({ status }) => {
      const isConnected = status === 'connected';
      const wasConnected = get().isConnected;

      if (isConnected) {
        // Connected implies authenticated: the gateway authenticates against
        // the backend before accepting the WebSocket handshake.
        consecutiveFailures = 0;
        clearTimeout(lostConnectionTimeout);
        set({ isConnected: true, isReady: true });
        return;
      }

      // If we were previously connected and now we're not,
      // we might have lost the connection
      if (
        status === 'disconnected' &&
        wasConnected &&
        !get().isPausedForInactivity
      ) {
        clearTimeout(lostConnectionTimeout);
        // Math.random() generates a random delay to avoid all clients
        // refetching at the same time
        lostConnectionTimeout = setTimeout(
          () => set({ hasLostConnection: true }),
          Math.random() * RECONNECT_JITTER_MAX_MS,
        );
      }

      set((state) => ({
        isConnected: false,
        isReady: state.isReady || status === 'disconnected',
      }));
    });

    provider.on('sync', (isSynced: boolean) => {
      set({ isSynced, isReady: true });
    });

    provider.on('connection-close', (event) => {
      if (event?.code === KICK_CLOSE_CODE) {
        // Server-side reset: the automatic reconnection re-authenticates
        // with up-to-date permissions. Not a failure.
        consecutiveFailures = 0;
      }
    });

    provider.on('connection-error', () => {
      if (get().isPausedForInactivity) {
        return;
      }
      consecutiveFailures += 1;
      if (consecutiveFailures === READY_WITHOUT_COLLAB_FAILURES) {
        // Unblock the editor (Django save fallback); reconnection attempts
        // keep running in the background and re-enable collaboration when
        // the server becomes reachable again.
        console.warn(
          'Collaboration server unreachable; editing without realtime sync.',
        );
        set({
          isReady: true,
          isConnected: false,
        });
      }
    });

    set({
      provider,
    });

    return provider;
  },
  destroyProvider: () => {
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
    get().provider?.connect();
  },
  resetLostConnection: () => set({ hasLostConnection: false }),
}));
