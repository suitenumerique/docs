import { create } from 'zustand';

import { Doc } from '@/features/docs/doc-management';

export interface DocRootTreeStore {
  rootId?: Doc['id'];
  setRootId: (id?: Doc['id']) => void;
}

export const useDocRootTreeStore = create<DocRootTreeStore>((set) => ({
  rootId: undefined,
  setRootId: (id?: string) => {
    set({ rootId: id });
  },
}));
