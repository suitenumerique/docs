import { create } from 'zustand';

import { Doc } from '@/docs/doc-management';

export interface UseDocStore {
  currentDoc?: Doc;
  setCurrentDoc: (doc: Doc | undefined) => void;
}

export const useDocStore = create<UseDocStore>((set) => ({
  currentDoc: undefined,
  setCurrentDoc: (doc) => {
    set({ currentDoc: doc });
  },
}));
