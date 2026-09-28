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

/**
 * Why an encrypted document could not be opened:
 * - `key_unavailable`: shared for a key version the user no longer holds
 *   (typically from before they reset their encryption);
 * - `key_mismatch`: the user's key cannot open the copy of the document key
 *   stored for them;
 * - `content_integrity`: the document key opened, the stored content failed its
 *   integrity check (damaged or altered);
 * - `unknown`: anything else (vault unreachable mid-way, unexpected error).
 */
export type DecryptionFailure =
  'key_unavailable' | 'key_mismatch' | 'content_integrity' | 'unknown';

export const decryptionFailureOf = (err: unknown): DecryptionFailure => {
  switch ((err as VaultError | null | undefined)?.code) {
    case 'KEY_VERSION_UNAVAILABLE':
      return 'key_unavailable';
    case 'WRONG_SECRET_KEY':
      return 'key_mismatch';
    case 'CONTENT_INTEGRITY_FAILED':
    case 'MALFORMED_CIPHERTEXT':
    case 'CIPHERTEXT_TOO_SHORT':
    case 'UNSUPPORTED_CRYPTO_VERSION':
      return 'content_integrity';
    default:
      return 'unknown';
  }
};

export interface UseCollaborationStore {
  createProvider: (
    providerUrl: string,
    storeId: string,
    initialDocState?: Uint8Array,
    encryptionOptions?: {
      vaultClient: VaultClient;
      encryptedSymmetricKey: ArrayBuffer;
      keyVersion: number;
    },
  ) => SwitchableProvider;
  destroyProvider: () => void;
  setReady: (value: boolean) => void;
  pauseForInactivity: () => void;
  resumeFromInactivity: () => void;
  notifyOthers: (event: EncryptionTransitionEvent) => void;
  startEncryptionTransition: (type: EncryptionTransitionType) => void;
  clearEncryptionTransition: () => void;
  provider: SwitchableProvider | undefined;
  isConnected: boolean;
  isReady: boolean;
  isSynced: boolean;
  hasLostConnection: boolean;
  isPausedForInactivity: boolean;
  encryptionTransition: EncryptionTransitionType | null;
  decryptionFailure: DecryptionFailure | null;
  setDecryptionFailure: (failure: DecryptionFailure) => void;
  resetLostConnection: () => void;
}

const defaultValues = {
  provider: undefined,
  isConnected: false,
  isReady: false,
  isSynced: false,
  hasLostConnection: false,
  isPausedForInactivity: false,
  encryptionTransition: null,
  decryptionFailure: null,
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

/**
 * Connection status handling shared by the Hocuspocus and relay providers.
 */
function handleStatus(
  isConnected: boolean,
  isDisconnected: boolean,
  set: (
    partial:
      | Partial<UseCollaborationStore>
      | ((state: UseCollaborationStore) => Partial<UseCollaborationStore>),
  ) => void,
  get: () => UseCollaborationStore,
) {
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
     * A connected status does not mean we are totally connected
     * because authentication can still be in progress and failed
     * So we only update isConnected when we lose the connection
     */
    const connected = !isConnected
      ? {
          isConnected: false,
        }
      : undefined;

    return {
      ...connected,
      isReady: state.isReady || isDisconnected,
    };
  });
}

/**
 * Reconnect after a clean disconnection, with jitter, unless the disconnection
 * came from inactivity: reconnection then happens once the user is active again.
 */
function scheduleReconnect(
  provider: SwitchableProvider,
  get: () => UseCollaborationStore,
) {
  if (get().isPausedForInactivity) {
    return;
  }

  clearTimeout(reconnectTimeout);

  reconnectTimeout = setTimeout(
    () => void provider.connect(),
    RECONNECT_BASE_DELAY_MS + Math.random() * RECONNECT_JITTER_MAX_MS,
  );
}

export const useProviderStore = create<UseCollaborationStore>((set, get) => ({
  ...defaultValues,
  setDecryptionFailure: (failure) => set({ decryptionFailure: failure }),
  createProvider: (wsUrl, storeId, initialDocState, encryptionOptions) => {
    const isEncrypted = !!encryptionOptions;

    const doc = new Y.Doc({
      guid: storeId,
    });

    if (initialDocState) {
      Y.applyUpdate(doc, initialDocState);
    }

    let provider: SwitchableProvider;

    if (isEncrypted) {
      const AdaptedEncryptedWebSocket = createAdaptedEncryptedWebsocketClass({
        vaultClient: encryptionOptions.vaultClient,
        encryptedSymmetricKey: encryptionOptions.encryptedSymmetricKey,
        keyVersion: encryptionOptions.keyVersion,
        onSystemMessage: (message) => {
          if (message === 'system:authenticated') {
            set({ isReady: true, isConnected: true });
          } else {
            handleEncryptionSystemMessage(message, set, get);
          }
        },
        onDecryptError: (err) => {
          // A key that cannot open the document key makes every message
          // unreadable; one damaged message alone does not end the session.
          const failure = decryptionFailureOf(err);
          if (failure === 'key_unavailable' || failure === 'key_mismatch') {
            set({ decryptionFailure: failure });
          }
        },
      });

      const relayProvider = new RelayProvider(wsUrl, storeId, doc, {
        WebSocketPolyfill: AdaptedEncryptedWebSocket,
        // For simplicity we always use websocket server even if there is local tabs,
        // otherwise the question would be do we need to encrypt also for local tabs through BroadcastChannel or not
        disableBc: true,
      });
      provider = relayProvider;

      relayProvider.on('connection-close', (event) => {
        if (event) {
          if (event.wasClean) {
            // Attempt to reconnect if the disconnection was clean (initiated by the client or server)
            scheduleReconnect(relayProvider, get);
          } else if (event.code === 1000) {
            /**
             * Handle the "Reset Connection" event from the server
             * This is triggered when the server wants to reset the connection
             * for clients in the room.
             * A disconnect is made automatically but it takes time to be triggered,
             * so we force the disconnection here.
             */
            relayProvider.disconnect();
          }
        }
      });

      relayProvider.on('status', (event) => {
        handleStatus(
          event.status === 'connected',
          event.status === 'disconnected',
          set,
          get,
        );
      });

      relayProvider.on('sync', (state) => {
        set({ isSynced: state, isReady: true });
      });
    } else {
      const hocuspocusProvider: HocuspocusProvider = new HocuspocusProvider({
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
            if (
              data.event.reason === 'No cookies' &&
              data.event.code === 4001
            ) {
              console.error(
                'Disconnection due to missing cookies. Not attempting to reconnect.',
              );
              void hocuspocusProvider.disconnect();
              set({
                isReady: true,
                isConnected: false,
              });
              return;
            }

            scheduleReconnect(hocuspocusProvider, get);
          }
        },
        onAuthenticationFailed() {
          set({ isReady: true, isConnected: false });
        },
        onAuthenticated() {
          set({ isReady: true, isConnected: true });
        },
        onStatus: ({ status }) => {
          handleStatus(
            status === WebSocketStatus.Connected,
            status === WebSocketStatus.Disconnected,
            set,
            get,
          );
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
            hocuspocusProvider.disconnect();
          }
        },
      });
      provider = hocuspocusProvider;
    }

    set({
      provider,
    });

    return provider;
  },
  startEncryptionTransition: (type: EncryptionTransitionType) => {
    clearTimeout(reconnectTimeout);
    clearTimeout(lostConnectionTimeout);
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
      isPausedForInactivity: false,
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
