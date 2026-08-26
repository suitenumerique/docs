import { HttpProvider, createWebsocketFallback } from '@y/yhub-http-fallback';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { create } from 'zustand';

import { collaborationHttpTarget } from '@/core/config/hooks/useCollaborationUrl';
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
  httpProvider: HttpProvider | undefined;
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
  httpProvider: undefined,
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

let lostConnectionTimeout: ReturnType<typeof setTimeout> | undefined;
/**
 * Uninstalls the http fallback, or undefined while it is not installed. Held here rather than
 * in the store: nothing renders from it, and it must survive `set(defaultValues)`.
 */
let stopFallback: (() => void) | undefined;

/**
 * Run the http provider only while the socket is not working, and stop it as soon as the socket
 * is back. The helper follows `provider.shouldConnect`, so a connection closed from here —
 * `pauseForInactivity` — stops both transports and revives neither until `connect()`.
 */
const installFallback = (
  provider: WebsocketProvider,
  httpProvider: HttpProvider | undefined,
) => {
  if (httpProvider && !stopFallback) {
    stopFallback = createWebsocketFallback(provider, httpProvider);
  }
};

/**
 * Stop polling and stay stopped. The helper retries a provider that gave up every 30s, which is
 * right for a network outage and wrong for a document that answered.
 */
const suspendFallback = (httpProvider: HttpProvider | undefined) => {
  stopFallback?.();
  stopFallback = undefined;
  httpProvider?.disconnect();
};

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

    /**
     * A second transport onto the same document, for the networks that refuse websocket
     * upgrades — corporate proxies, captive portals — where the socket above never opens and
     * the editor would otherwise render the last snapshot and sync nothing. It polls y/hub's
     * REST api on the same room, with the same session cookie and the same authorization, so
     * the only thing that changes is latency.
     *
     * It shares the document, so nothing has to be flushed when the transport changes: what
     * one provider retrieved is part of the document, and the other publishes it on its next
     * sync. It shares the `Awareness` instance for the same reason — awareness state is keyed
     * by `doc.clientID`, so two instances would advertise the same client id with independent
     * clocks and fight over the local state.
     */
    const target = collaborationHttpTarget(wsUrl);
    const httpProvider = target
      ? new HttpProvider(
          doc,
          target.serverUrl,
          { org: target.org, docid: storeId },
          {
            awareness: provider.awareness,
            // createWebsocketFallback owns the connection state
            connect: false,
            // Docs users are served the garbage-collected document; a full-history request is
            // refused by the collaboration server, and this defaults to `false`
            gc: true,
            // the session cookie is the credential here too, exactly as on the ws upgrade
            fetch: (input, init) =>
              fetch(input, { ...init, credentials: 'include' }),
          },
        )
      : undefined;

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

    // Either transport being synced is what `useUpdateDoc` asks about: it decides whether the
    // backend is told that the content is held by the collaboration server.
    const syncState = () =>
      set({
        isSynced: provider.synced || (httpProvider?.synced ?? false),
        isReady: true,
      });

    provider.on('sync', syncState);
    httpProvider?.on('sync', syncState);

    // Fires on every close AND every failed connection attempt
    // (an auth failure surfaces as an upgrade-level 401, close code 1006).
    provider.on('connection-close', () => {
      // Skip when the disconnect was triggered by inactivity:
      // reconnection only happens once the user becomes active again.
      if (get().isPausedForInactivity) {
        return;
      }

      // The editor renders from the last snapshot, and the http fallback takes over, while
      // y-websocket retries
      set({ isConnected: false, isReady: true });

      clearTimeout(lostConnectionTimeout);
      // Jitter spreading: Math.random() generates a random delay to avoid
      // all clients invalidating their queries at the same time
      lostConnectionTimeout = setTimeout(
        () => set({ hasLostConnection: true }),
        Math.random() * RECONNECT_JITTER_MAX_MS,
      );
    });

    // Installed before the `closed` listener below, and that order is the point: lib0 hands an
    // event to a snapshot of its listeners, so unsubscribing from inside one does not stop the
    // ones registered after it. The helper reacts to `closed` by starting the http provider;
    // ours has to run last to be the one that has the final word.
    installFallback(provider, httpProvider);

    /**
     * The collaboration server refused this connection rather than losing it: its access
     * changed (4401) or the document was deleted (4404). It has answered, and reconnecting on
     * a timer only asks the same question again — for a document that may never come back, for
     * as long as the tab stays open. y-websocket stops its retry loop on those codes by itself;
     * this stops the http fallback with it, which would otherwise both poll a document we have
     * just been refused and revive the socket every 30s.
     *
     * Refused is not the same as gone: an access upgraded from reader to editor is a refusal
     * too, and the connection has to be made again to carry the new rights. Asking the backend
     * is what settles it, in `useCollaboration`, which resumes through `reconnect` below.
     */
    provider.on('closed', () => {
      suspendFallback(httpProvider);

      // beats the hasLostConnection timer the close above has just armed
      clearTimeout(lostConnectionTimeout);
      lostConnectionTimeout = setTimeout(
        () => set({ isPermanentlyClosed: true }),
        Math.random() * RECONNECT_JITTER_MAX_MS,
      );
    });

    set({
      provider,
      httpProvider,
    });

    return provider;
  },
  destroyProvider: () => {
    const { provider, httpProvider } = get();

    stopFallback?.();
    stopFallback = undefined;

    // publishes a farewell awareness state, best effort, so the others see us leave
    httpProvider?.destroy();

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
    // the fallback follows `shouldConnect`, so this stops the polling too
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
    const { provider, httpProvider } = get();

    set({ isPermanentlyClosed: false });

    if (!provider) {
      return;
    }

    provider.connect();
    installFallback(provider, httpProvider);
  },
}));
