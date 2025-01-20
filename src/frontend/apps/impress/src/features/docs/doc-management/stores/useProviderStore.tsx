import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { create } from 'zustand';

import { Base64 } from '@/features/docs/doc-management';

import { CollaborationProvider } from '../libs/CollaborationProvider';

export interface UseCollaborationStore {
  createProvider: (
    providerUrl: string,
    storeId: string,
    canEdit: boolean,
    initialDoc?: Base64,
  ) => HocuspocusProvider;
  destroyProvider: () => void;
  provider: HocuspocusProvider | undefined;
}

const defaultValues = {
  provider: undefined,
};

export const useProviderStore = create<UseCollaborationStore>((set, get) => ({
  ...defaultValues,
  createProvider: (wsUrl, storeId, canEdit, initialDoc) => {
    const doc = new Y.Doc({
      guid: storeId,
    });

    if (initialDoc) {
      Y.applyUpdate(doc, Buffer.from(initialDoc, 'base64'));
    }

    const provider = new CollaborationProvider({
      url: wsUrl,
      name: storeId,
      document: doc,
      canEdit,
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
