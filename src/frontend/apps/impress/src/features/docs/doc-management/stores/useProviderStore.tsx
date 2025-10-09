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
  hasLostConnection: boolean;
  resetLostConnection: () => void;
}

const defaultValues = {
  provider: undefined,
  isConnected: false,
  hasLostConnection: false,
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

    const provider = new HocuspocusProvider({
      url: wsUrl,
      name: storeId,
      document: doc,
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
