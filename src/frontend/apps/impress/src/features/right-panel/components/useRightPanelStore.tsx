import { create } from 'zustand';

export type RightPanelView = 'tableContent' | 'comments';

export interface UseRightPanelStore {
  isPanelOpen: boolean;
  activePanel: RightPanelView | null;
  setActivePanel: (panel: RightPanelView | null) => void;
  setIsPanelOpen: (isOpen: boolean) => void;
  togglePanel: () => void;
}

export const useRightPanelStore = create<UseRightPanelStore>((set) => ({
  isPanelOpen: false,
  activePanel: null,
  setActivePanel: (activePanel) =>
    set(() => ({ activePanel, isPanelOpen: activePanel !== null })),
  setIsPanelOpen: (isPanelOpen) =>
    set((state) => ({
      isPanelOpen,
      activePanel: isPanelOpen ? state.activePanel : null,
    })),
  togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),
}));
