import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { create } from 'zustand';

import { Base64 } from '@/docs/doc-management';

export interface UseCollaborationStore {
  createProvider: (
    providerUrl: string,
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
  isPermanentlyClosed: boolean;
  resetLostConnection: () => void;
  reconnect: () => void;
}

const defaultValues = {
  provider: undefined,
  isConnected: false,
  isReady: false,
  isSynced: false,
  hasLostConnection: false,
  isPausedForInactivity: false,
  isPermanentlyClosed: false,
};

/**
 * When a massive simultaneous disconnection occurs (e.g. infra restart), all
 * clients would reconnect and invalidate their queries at exactly the same
 * time, causing a possible DB spike. Adding random jitter spreads these events over a
 * time window so the load is absorbed gradually.
 */
const RECONNECT_JITTER_MAX_MS = 3000;

/**
 * Close codes 4400-4499 are the collaboration server refusing this connection
 * rather than losing it: its access changed (4401) or the document was deleted
 * (4404). It has answered, and reconnecting on a timer only asks the same
 * question again — twice a minute, for as long as the tab stays open, for a
 * document that may never come back. Everything else (a dropped socket, a
 * server restart, an upgrade that failed) is transient and keeps its retry
 * loop.
 *
 * Refused is not the same as gone: an access upgraded from reader to editor is
 * a refusal too, and the connection has to be made again to carry the new
 * rights. Asking the backend is what settles it, in `useCollaboration`.
 */
const isPermanentCloseCode = (code: number) => code >= 4400 && code <= 4499;

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

    const provider = new WebsocketProvider(wsUrl, storeId, doc, {
      // BroadcastChannel would bypass server auth
      disableBc: true,
      // The default 2.5s backoff would hammer the backend with auth fetches
      // on permanently-failing sockets
      maxBackoffTime: 30000,
      // Guarantees inbound traffic for y-websocket's 30s no-traffic watchdog
      resyncInterval: 20000,
    });

    provider.on('status', ({ status }) => {
      // 'connecting' must be ignored: it fires on every backoff retry.
      // 'disconnected' is handled via 'connection-close' (it never fires
      // for sockets that failed to open).
      if (status === 'connected') {
        clearTimeout(lostConnectionTimeout);
        // An open socket means we are authenticated (auth happens at upgrade)
        set({ isConnected: true, isReady: true });
      }
    });

    provider.on('sync', (isSynced: boolean) => {
      set({ isSynced, isReady: true });
    });

    // Fires on every close AND every failed connection attempt
    // (an auth failure surfaces as an upgrade-level 401, close code 1006).
    // The event is null when the socket was closed from here.
    provider.on('connection-close', (event) => {
      // Skip when the disconnect was triggered by inactivity:
      // reconnection only happens once the user becomes active again.
      if (get().isPausedForInactivity) {
        return;
      }

      // The editor renders from the last snapshot while y-websocket retries
      set({ isConnected: false, isReady: true });

      clearTimeout(lostConnectionTimeout);
      // Jitter spreading: Math.random() generates a random delay to avoid
      // all clients invalidating their queries at the same time
      const jitter = Math.random() * RECONNECT_JITTER_MAX_MS;

      if (event && isPermanentCloseCode(event.code)) {
        /**
         * Stop the retry loop. Assigning `shouldConnect` rather than calling
         * `disconnect()`: this runs inside y-websocket's own close handling,
         * and `disconnect()` closes the socket that is already closing, which
         * re-enters this listener. The reconnection it has just scheduled reads
         * the flag back when it fires, and gives up.
         */
        provider.shouldConnect = false;
        lostConnectionTimeout = setTimeout(
          () => set({ isPermanentlyClosed: true }),
          jitter,
        );
        return;
      }

      lostConnectionTimeout = setTimeout(
        () => set({ hasLostConnection: true }),
        jitter,
      );
    });

    set({
      provider,
    });

    return provider;
  },
  destroyProvider: () => {
    const provider = get().provider;
    if (provider) {
      /**
       * destroy() emits 'connection-close' synchronously before removing
       * listeners, which re-arms lostConnectionTimeout: it must be cleared
       * after, or a stale "connection lost" banner flashes on the next doc.
       */
      provider.destroy();
      // y-websocket never destroys the awareness: its interval would leak
      provider.awareness.destroy();
      provider.doc.destroy();
    }
    clearTimeout(lostConnectionTimeout);

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
    // a connection that was refused for good is only reopened by `reconnect`,
    // once the backend has been asked again — becoming active is not an answer
    if (get().isPermanentlyClosed) {
      return;
    }
    get().provider?.connect();
  },
  resetLostConnection: () => set({ hasLostConnection: false }),
  /**
   * Open the connection again after it was refused for good, once the backend
   * has confirmed the document is still there to open.
   */
  reconnect: () => {
    set({ isPermanentlyClosed: false });
    get().provider?.connect();
  },
}));
