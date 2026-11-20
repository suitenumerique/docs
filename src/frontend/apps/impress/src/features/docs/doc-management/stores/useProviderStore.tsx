import { Awareness } from '@y/protocols/awareness';
import { WebsocketProvider } from '@y/websocket';
import * as Y from '@y/y';
import { create } from 'zustand';

import { collaborationHttpTarget } from '@/core/config/hooks/useCollaborationUrl';
import { Base64 } from '@/docs/doc-management';

import { withJsonTransport } from '../api/httpFallbackJson';
import { HttpFallback } from '../httpFallback';
import { rememberLocalDoc } from '../localDocs';
import { LocalPersistence } from '../localPersistence';

export interface CreateProviderOptions {
  readOnly?: boolean;
  httpJson?: boolean;
  httpSyncInterval?: number;
  httpAwareness?: boolean;
}

interface UseCollaborationStore {
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
  provider?: WebsocketProvider;
  persistence?: LocalPersistence;
  isConnected: boolean;
  isReady: boolean;
  isSynced: boolean;
  hasLostConnection: boolean;
  isPausedForInactivity: boolean;
  isPermanentlyClosed: boolean;
  resetLostConnection: () => void;
  reconnect: () => void;
}

const RECONNECT_JITTER_MAX_MS = 3000;
const hasContent = (doc: Y.Doc) => doc.get('document-store').length > 0;

let lostConnectionTimeout: ReturnType<typeof setTimeout>;
let fallbackTimeout: ReturnType<typeof setTimeout>;
let fallback: HttpFallback | undefined;

const defaultValues: Omit<
  UseCollaborationStore,
  | 'createProvider'
  | 'destroyProvider'
  | 'setReady'
  | 'pauseForInactivity'
  | 'resumeFromInactivity'
  | 'resetLostConnection'
  | 'reconnect'
> = {
  provider: undefined,
  persistence: undefined,
  isConnected: false,
  isReady: false,
  isSynced: false,
  hasLostConnection: false,
  isPausedForInactivity: false,
  isPermanentlyClosed: false,
};

export const useCollaborationStore = create<UseCollaborationStore>()(
  (set, get) => ({
    ...defaultValues,
    createProvider: (
      wsUrl,
      storeId,
      initialDoc,
      {
        readOnly = false,
        httpJson = false,
        httpSyncInterval,
        httpAwareness = true,
      } = {},
    ) => {
      const doc = new Y.Doc({ guid: storeId });
      if (initialDoc) {
        Y.applyUpdate(doc, Buffer.from(initialDoc, 'base64'));
      }

      const awareness = new Awareness(doc);
      if (readOnly) {
        // Readers can receive remote presence, but must not publish their own.
        awareness.setLocalState(null);
      }

      let persistence: LocalPersistence | undefined;
      if (typeof indexedDB !== 'undefined') {
        try {
          persistence = new LocalPersistence(storeId, doc, () => {
            if (hasContent(doc)) {
              set({ isReady: true });
            }
          });
          void rememberLocalDoc(storeId);
        } catch (error) {
          console.error('Failed to open the local copy of the document', error);
        }
      }

      const provider = new WebsocketProvider(wsUrl, storeId, doc, {
        disableBc: true,
        maxBackoffTime: 30000,
        resyncInterval: 20000,
        awareness,
      });

      const target = collaborationHttpTarget(wsUrl);
      const carriesAwareness = !readOnly && httpAwareness;
      const pollInterval = Math.max(5000, httpSyncInterval ?? 10000);
      const send: typeof fetch = (input, init) => fetch(input, init);
      fallback = target
        ? new HttpFallback(
            doc,
            `${target.serverUrl}/ydoc/v1/${target.org}/${storeId}?branch=main&gc=true&awareness=${carriesAwareness}`,
            carriesAwareness ? awareness : undefined,
            () => set({ isSynced: true, isReady: true }),
            () => {
              provider.shouldConnect = false;
              provider.disconnect();
              clearTimeout(lostConnectionTimeout);
              clearTimeout(fallbackTimeout);
              set({
                isConnected: false,
                hasLostConnection: false,
                isPermanentlyClosed: true,
              });
            },
            readOnly,
            carriesAwareness ? Math.min(pollInterval, 15000) : pollInterval,
            httpJson ? withJsonTransport(send) : send,
          )
        : undefined;
      const startFallback = () => {
        clearTimeout(fallbackTimeout);
        if (provider.shouldConnect && !get().isPausedForInactivity) {
          fallback?.connect();
        }
      };
      const waitForFallback = () => {
        clearTimeout(fallbackTimeout);
        fallbackTimeout = setTimeout(startFallback, 5000);
      };
      waitForFallback();

      const syncState = () => {
        const isSynced = provider.synced || (fallback?.synced ?? false);
        set({
          isSynced,
          isReady: get().isReady || isSynced || hasContent(doc),
        });
      };

      provider.on('status', ({ status }) => {
        if (status === 'connected') {
          clearTimeout(lostConnectionTimeout);
          clearTimeout(fallbackTimeout);
          fallback?.disconnect();
          set({ isConnected: true });
        } else if (status === 'disconnected' && provider.shouldConnect) {
          waitForFallback();
        }
      });

      provider.on('sync', syncState);

      provider.on('connection-close', (event: CloseEvent | null) => {
        if (get().isPausedForInactivity) {
          return;
        }
        if (event?.code === 4401 || event?.code === 4404) {
          // This callback runs before @y/websocket clears its socket. Calling
          // disconnect() here would re-enter the same close handler.
          provider.shouldConnect = false;
          clearTimeout(lostConnectionTimeout);
          clearTimeout(fallbackTimeout);
          fallback?.disconnect();
          set({
            isConnected: false,
            isReady: get().isReady || hasContent(doc),
            hasLostConnection: false,
            isPermanentlyClosed: true,
          });
          return;
        }
        if (
          provider.shouldConnect &&
          event?.code !== 1011 &&
          event?.code !== 1013 &&
          !(event?.code && event.code >= 4500 && event.code < 4600)
        ) {
          startFallback();
        }
        const { isConnected: wasConnected, isReady: wasReady } = get();
        const isReady = wasReady || hasContent(doc);
        if (wasConnected || isReady !== wasReady) {
          set({ isConnected: false, isReady });
        }
        if (!wasConnected) {
          return;
        }
        clearTimeout(lostConnectionTimeout);
        lostConnectionTimeout = setTimeout(
          () => set({ hasLostConnection: true }),
          Math.random() * RECONNECT_JITTER_MAX_MS,
        );
      });

      set({ provider, persistence });
      return provider;
    },
    destroyProvider: () => {
      const { provider, persistence } = get();
      clearTimeout(fallbackTimeout);
      fallback?.destroy();
      fallback = undefined;
      void persistence?.destroy();
      if (provider) {
        provider.destroy();
        provider.awareness.destroy();
        provider.doc.destroy();
      }
      clearTimeout(lostConnectionTimeout);
      set(defaultValues);
    },
    setReady: (value) => {
      set({ isReady: value });
    },
    pauseForInactivity: () => {
      if (get().isPausedForInactivity) {
        return;
      }
      clearTimeout(lostConnectionTimeout);
      clearTimeout(fallbackTimeout);
      fallback?.disconnect();
      set({ isPausedForInactivity: true, hasLostConnection: false });
      get().provider?.disconnect();
    },
    resumeFromInactivity: () => {
      if (!get().isPausedForInactivity) {
        return;
      }
      clearTimeout(lostConnectionTimeout);
      set({ isPausedForInactivity: false });
      if (get().isPermanentlyClosed) {
        return;
      }
      get().provider?.connect();
      clearTimeout(fallbackTimeout);
      fallbackTimeout = setTimeout(() => fallback?.connect(), 5000);
    },
    resetLostConnection: () => {
      set({ hasLostConnection: false });
    },
    reconnect: () => {
      const { provider } = get();
      set({ isPermanentlyClosed: false });
      if (!provider) {
        return;
      }
      provider.connect();
      clearTimeout(fallbackTimeout);
      fallbackTimeout = setTimeout(() => fallback?.connect(), 5000);
    },
  }),
);

export const useProviderStore = useCollaborationStore;
