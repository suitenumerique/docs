import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { create } from 'zustand';

import { Base64 } from '@/features/docs/doc-management';

export interface UseCollaborationStore {
  createProvider: (
    providerUrl: string,
    storeId: string,
    initialDoc?: Base64,
  ) => HocuspocusProvider;
  destroyProvider: () => void;
  failureCount: number;
  maxFailureCount: number;
  provider: HocuspocusProvider | undefined;
  isProviderFailure: boolean;
}

const defaultValues = {
  failureCount: 0,
  maxFailureCount: 4,
  provider: undefined,
  isProviderFailure: false,
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
      onConnect: () => {
        set({
          failureCount: 0,
          isProviderFailure: false,
        });
      },
      onClose: () => {
        set({
          failureCount: get().failureCount + 1,
        });

        if (
          !get().isProviderFailure &&
          get().failureCount > get().maxFailureCount
        ) {
          set({
            isProviderFailure: true,
          });
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
}));
