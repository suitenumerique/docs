import { create } from 'zustand';

export interface UseRightPanelStore {
  isPanelOpen: boolean;
  setIsPanelOpen: (isOpen: boolean) => void;
  togglePanel: () => void;
}

export const useRightPanelStore = create<UseRightPanelStore>((set) => ({
  isPanelOpen: false,
  setIsPanelOpen: (isPanelOpen) => {
    set(() => ({ isPanelOpen }));
  },
  togglePanel: () => {
    set((state) => ({ isPanelOpen: !state.isPanelOpen }));
  },
}));
