import { CloseEvent } from '@hocuspocus/common';
import { HocuspocusProvider, WebSocketStatus } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { create } from 'zustand';

import { createAdaptedEncryptedWebsocketClass } from '@/docs/doc-collaboration/encryptedWebsocket';
import { RelayProvider } from '@/docs/doc-collaboration/relayProvider';

export type SwitchableProvider = RelayProvider | HocuspocusProvider;

export interface UseCollaborationStore {
  createProvider: (
    providerUrl: string,
    storeId: string,
    initialDocState?: Buffer<ArrayBuffer>,
    encryption?: {
      symmetricKey: CryptoKey;
    },
  ) => SwitchableProvider;
  destroyProvider: () => void;
  provider: SwitchableProvider | undefined;
  isConnected: boolean;
  isReady: boolean;
  isSynced: boolean;
  hasLostConnection: boolean;
  resetLostConnection: () => void;
}

const defaultValues = {
  provider: undefined,
  isConnected: false,
  isReady: false,
  isSynced: false,
  hasLostConnection: false,
};

export const useProviderStore = create<UseCollaborationStore>((set, get) => ({
  ...defaultValues,
  createProvider: (wsUrl, storeId, initialDocState, encryption) => {
    const isEncrypted = !!encryption;

    const doc = new Y.Doc({
      guid: storeId,
    });

    if (initialDocState) {
      Y.applyUpdate(doc, initialDocState);
    }

    let provider: SwitchableProvider;

    if (isEncrypted) {
      //
      // TODO: should implement features for authentication (listening on message with custom payload?)
      // same for previous "onSynced"
      //

      const AdaptedEncryptedWebSocket = createAdaptedEncryptedWebsocketClass({
        encryptionKey: encryption.symmetricKey,
        decryptionKey: encryption.symmetricKey,
      });

      provider = new RelayProvider(wsUrl, storeId, doc, {
        WebSocketPolyfill: AdaptedEncryptedWebSocket,
        // For simplicity we always use websocket server even if there is local tabs,
        // otherwise the question would be do we need to encrypt also for local tabs through BroadcastChannel or not
        disableBc: true,
      });

      provider.on('connection-close', (event) => {
        if (event) {
          if (event.wasClean) {
            // Attempt to reconnect if the disconnection was clean (initiated by the client or server)
            void provider.connect();
          } else if (event.code === 1000) {
            /**
             * Handle the "Reset Connection" event from the server
             * This is triggered when the server wants to reset the connection
             * for clients in the room.
             * A disconnect is made automatically but it takes time to be triggered,
             * so we force the disconnection here.
             */
            provider.disconnect();
          }
        }
      });

      provider.on('status', (event) => {
        set((state) => {
          const nextConnected = event.status === 'connected';

          /**
           * status === 'connected' does not mean we are totally connected
           * because authentication can still be in progress and failed
           * So we only update isConnected when we loose the connection
           */
          const connected =
            event.status !== 'connected'
              ? {
                  isConnected: false,
                }
              : undefined;

          return {
            ...connected,
            isReady: state.isReady || event.status === 'disconnected',
            hasLostConnection:
              state.isConnected && !nextConnected
                ? true
                : state.hasLostConnection,
          };
        });
      });

      provider.on('sync', (state) => {
        set({ isSynced: state, isReady: true });
      });
    } else {
      provider = new HocuspocusProvider({
        url: wsUrl,
        name: storeId,
        document: doc,
        onDisconnect(data) {
          type ExtendedCloseEvent = CloseEvent & { wasClean: boolean };

          // Attempt to reconnect if the disconnection was clean (initiated by the client or server)
          if ((data.event as ExtendedCloseEvent).wasClean) {
            void provider.connect();
          }
        },
        onAuthenticationFailed() {
          set({ isReady: true, isConnected: false });
        },
        onAuthenticated() {
          set({ isReady: true, isConnected: true });
        },
        onStatus: ({ status }) => {
          set((state) => {
            const nextConnected = status === WebSocketStatus.Connected;

            /**
             * status === WebSocketStatus.Connected does not mean we are totally connected
             * because authentication can still be in progress and failed
             * So we only update isConnected when we loose the connection
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
              hasLostConnection:
                state.isConnected && !nextConnected
                  ? true
                  : state.hasLostConnection,
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
    }

    set({
      provider,
    });

    return provider;
  },
  destroyProvider: () => {
    const provider = get().provider;
    if (provider) {
      provider.destroy();
    }

    set(defaultValues);
  },
  resetLostConnection: () => set({ hasLostConnection: false }),
}));
