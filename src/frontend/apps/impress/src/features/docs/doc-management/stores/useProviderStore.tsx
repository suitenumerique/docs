import { CloseEvent } from '@hocuspocus/common';
import { HocuspocusProvider, WebSocketStatus } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { create } from 'zustand';

import {
  EncryptedWebSocket,
  createAdaptedEncryptedWebsocketClass,
} from '@/docs/doc-collaboration/encryptedWebsocket';
import { RelayProvider } from '@/docs/doc-collaboration/relayProvider';

export enum EncryptionTransitionEvent {
  ENCRYPTION_STARTED = 'system:encryption-started',
  ENCRYPTION_SUCCEEDED = 'system:encryption-succeeded',
  ENCRYPTION_CANCELED = 'system:encryption-canceled',
  REMOVE_ENCRYPTION_STARTED = 'system:remove-encryption-started',
  REMOVE_ENCRYPTION_SUCCEEDED = 'system:remove-encryption-succeeded',
  REMOVE_ENCRYPTION_CANCELED = 'system:remove-encryption-canceled',
}

export type SwitchableProvider = RelayProvider | HocuspocusProvider;

export type EncryptionTransitionType = 'encrypting' | 'removing-encryption';

export interface UseCollaborationStore {
  createProvider: (
    providerUrl: string,
    storeId: string,
    initialDocState?: Buffer<ArrayBuffer>,
    symmetricKey?: CryptoKey,
  ) => SwitchableProvider;
  destroyProvider: () => void;
  notifyOthers: (event: EncryptionTransitionEvent) => void;
  startEncryptionTransition: (type: EncryptionTransitionType) => void;
  clearEncryptionTransition: () => void;
  provider: SwitchableProvider | undefined;
  isConnected: boolean;
  isReady: boolean;
  isSynced: boolean;
  hasLostConnection: boolean;
  encryptionTransition: EncryptionTransitionType | null;
  resetLostConnection: () => void;
}

const defaultValues = {
  provider: undefined,
  isConnected: false,
  isReady: false,
  isSynced: false,
  hasLostConnection: false,
  encryptionTransition: null,
};

function handleEncryptionSystemMessage(
  message: string,
  set: (partial: Partial<UseCollaborationStore>) => void,
  get: () => UseCollaborationStore,
) {
  switch (message) {
    case EncryptionTransitionEvent.ENCRYPTION_STARTED:
      set({ encryptionTransition: 'encrypting' });
      break;
    case EncryptionTransitionEvent.REMOVE_ENCRYPTION_STARTED:
      set({ encryptionTransition: 'removing-encryption' });
      break;
    case EncryptionTransitionEvent.ENCRYPTION_SUCCEEDED:
      get().startEncryptionTransition('encrypting');
      break;
    case EncryptionTransitionEvent.REMOVE_ENCRYPTION_SUCCEEDED:
      get().startEncryptionTransition('removing-encryption');
      break;
    case EncryptionTransitionEvent.ENCRYPTION_CANCELED:
    case EncryptionTransitionEvent.REMOVE_ENCRYPTION_CANCELED:
      set({ encryptionTransition: null });
      break;
  }
}

export const useProviderStore = create<UseCollaborationStore>((set, get) => ({
  ...defaultValues,
  createProvider: (wsUrl, storeId, initialDocState, encryptionSymmetricKey) => {
    const isEncrypted = !!encryptionSymmetricKey;

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
        encryptionKey: encryptionSymmetricKey,
        decryptionKey: encryptionSymmetricKey,
        onSystemMessage: (message) => {
          if (message === 'system:authenticated') {
            set({ isReady: true, isConnected: true });
          } else {
            handleEncryptionSystemMessage(message, set, get);
          }
        },
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
        onStateless: ({ payload }) => {
          handleEncryptionSystemMessage(payload, set, get);
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
  startEncryptionTransition: (type: EncryptionTransitionType) => {
    const provider = get().provider;

    // switching between hocuspocus and relay servers, we have to properly close the current one
    if (provider) {
      provider.destroy();
    }

    // set the right data so the page component has the indication it needs to fetch again document data
    set({
      encryptionTransition: type,
      provider: undefined,
      isConnected: false,
      isReady: false,
      isSynced: false,
      hasLostConnection: false,
    });
  },
  clearEncryptionTransition: () => {
    set({ encryptionTransition: null });
  },
  notifyOthers: (event: EncryptionTransitionEvent) => {
    const provider = get().provider;

    if (!provider) {
      return;
    }

    if (provider instanceof HocuspocusProvider) {
      provider.sendStateless(event);
    } else if (provider instanceof RelayProvider) {
      const ws = provider.ws as EncryptedWebSocket | null;

      if (ws) {
        ws.sendSystemMessage(event);
      }
    }
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
