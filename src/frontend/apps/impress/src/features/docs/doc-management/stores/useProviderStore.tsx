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
  provider: HocuspocusProvider | undefined;
  isConnected: boolean;
  isSynced: boolean;
  hasLostConnection: boolean;
  resetLostConnection: () => void;
}

const defaultValues = {
  provider: undefined,
  isConnected: false,
  isSynced: false,
  hasLostConnection: false,
};

type ExtendedCloseEvent = CloseEvent & { wasClean: boolean };

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
        // Attempt to reconnect if the disconnection was clean (initiated by the client or server)
        if ((data.event as ExtendedCloseEvent).wasClean) {
          provider.connect();
        }
      },
      onStatus: ({ status }) => {
        set((state) => {
          const nextConnected = status === WebSocketStatus.Connected;
          return {
            isConnected: nextConnected,
            hasLostConnection:
              state.isConnected && !nextConnected
                ? true
                : state.hasLostConnection,
          };
        });
      },
      onSynced: ({ state }) => {
        set({ isSynced: state });
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
    const provider = get().provider;
    if (provider) {
      provider.destroy();
    }

    set(defaultValues);
  },
  resetLostConnection: () => set({ hasLostConnection: false }),
}));
