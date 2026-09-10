import { HttpProvider, createWebsocketFallback } from '@y/yhub-http-fallback';
import { IndexeddbPersistence } from 'y-indexeddb';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { create } from 'zustand';

import { collaborationHttpTarget } from '@/core/config/hooks/useCollaborationUrl';
import { Base64 } from '@/docs/doc-management';

import { rememberLocalDoc } from '../localDocs';

/**
 * `readOnly` decides whether this client may publish presence. It has to be known
 * when the providers are built, not merely when the editor renders: the http
 * fallback either carries an awareness instance or does not, and there is no
 * middle setting (see `createProvider`).
 */
export interface CreateProviderOptions {
  readOnly?: boolean;
}

export interface UseCollaborationStore {
  createProvider: (
    providerUrl: string,
    storeId: string,
    initialDoc?: Base64,
    options?: CreateProviderOptions,
  ) => WebsocketProvider;
  destroyProvider: () => void;
  setReady: (value: boolean) => void;
  pauseForInactivity: () => void;
  resumeFromInactivity: () => void;
  provider: WebsocketProvider | undefined;
  httpProvider: HttpProvider | undefined;
  persistence: IndexeddbPersistence | undefined;
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
  persistence: undefined,
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

/**
 * What a reader's `PATCH /ydoc` becomes: dropped here, and reported as accepted.
 * A reader may not write.
 */
const readerWriteDropped = () =>
  Promise.resolve(new Response(null, { status: 204 }));

/**
 * Keep a local copy of the document, when the browser lets us.
 *
 * `indexedDB` is absent more often than it looks - a browser told to block site
 * data, some private windows, and every non-browser context this module is
 * imported into. Local persistence is a convenience, so a browser without it
 * gets an editor that works exactly as it did before rather than no editor:
 * `undefined` here, and every caller treats that as "no local copy".
 */
const createPersistence = (storeId: string, doc: Y.Doc) => {
  if (typeof indexedDB === 'undefined') {
    return undefined;
  }

  try {
    return new IndexeddbPersistence(storeId, doc);
  } catch (error) {
    console.error('Failed to open the local copy of the document', error);
    return undefined;
  }
};

export const useProviderStore = create<UseCollaborationStore>((set, get) => ({
  ...defaultValues,
  createProvider: (wsUrl, storeId, initialDoc, { readOnly = false } = {}) => {
    const doc = new Y.Doc({
      guid: storeId,
    });

    if (initialDoc) {
      Y.applyUpdate(doc, Buffer.from(initialDoc, 'base64'));
    }

    /**
     * Used for the offline mode, it keeps a local copy of the document in IndexedDB so that
     * the editor can display the last known state even when the network is unavailable.
     */
    const persistence = createPersistence(storeId, doc);

    if (persistence) {
      // Record the local copy immediately to prevent it from being swept as an orphan.
      void rememberLocalDoc(storeId);

      /**
       * The editor waits on `isReady` (see `DocEditor`), and local content is enough to render:
       * whatever the connection then brings merges into what is already on screen.
       */
      persistence.on('synced', () => set({ isReady: true }));
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
     *
     * A reader gets no awareness instance at all. It may not publish presence (the
     * collaboration server refuses the `awareness` field of a `PATCH`, and the endpoint grant
     * makes the whole route read-only for it), and the provider has no receive-only setting:
     * one flag both publishes the local state and applies the remote one. Left enabled, the
     * first round would `PATCH` presence, take a 403, and — a 4xx being permanent — close the
     * provider for good *before* it ever issued its first `GET`, so a reader on a network that
     * blocks websockets would sit in front of an empty document indefinitely. Disabled, the
     * round carries no body at all and degrades to exactly the poll a reader needs. The cost is
     * that a reader on the fallback sees no remote cursors; at a 10s poll they would be a
     * postcard from the past anyway.
     */
    const target = collaborationHttpTarget(wsUrl);
    const httpProvider = target
      ? new HttpProvider(
          doc,
          target.serverUrl,
          { org: target.org, docid: storeId },
          {
            awareness: readOnly ? null : provider.awareness,
            // createWebsocketFallback owns the connection state
            connect: false,
            // Docs users are served the garbage-collected document; a full-history request is
            // refused by the collaboration server, and this defaults to `false`
            gc: true,
            // the session cookie is the credential here too, exactly as on the ws upgrade
            fetch: (input, init) =>
              readOnly && init?.method === 'PATCH'
                ? readerWriteDropped()
                : fetch(input, { ...init, credentials: 'include' }),
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

      const { isConnected: wasConnected, isReady: wasReady } = get();

      // This also fires on every failed reconnect attempt - forever, on a network that never
      // lets the socket open. Skip the `set()` once these are already at this value, or a
      // same-value write still hands every no-selector subscriber a new object to re-render on.
      if (wasConnected || !wasReady) {
        set({ isConnected: false, isReady: true });
      }

      // Only a connection that had actually opened can have been *lost* in a way that means
      // our access changed. A socket that never opens retries forever; refetching the document
      // on each attempt would only thrash the query while the http fallback carries it fine.
      if (!wasConnected) {
        return;
      }

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
      persistence,
    });

    return provider;
  },
  destroyProvider: () => {
    const { provider, httpProvider, persistence } = get();

    stopFallback?.();
    stopFallback = undefined;

    // publishes a farewell awareness state, best effort, so the others see us leave
    httpProvider?.destroy();

    // Destroy the persistence layer, which keeps the local copy of the document.
    void persistence?.destroy();

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
