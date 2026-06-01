import { create } from 'zustand';

import type { DocsThreadStore } from '../api/DocsThreadStore';

export interface UseThreadStore {
  threadStore?: DocsThreadStore;
  setThreadStore: (threadStore: DocsThreadStore | undefined) => void;
}

export const useThreadStore = create<UseThreadStore>((set) => ({
  threadStore: undefined,
  setThreadStore: (threadStore) => {
    set({ threadStore });
  },
}));
