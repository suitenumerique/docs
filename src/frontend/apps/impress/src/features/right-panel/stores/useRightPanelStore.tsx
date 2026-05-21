import { create } from 'zustand';

export type RightPanelView = 'tableContent' | 'comments';

export interface UseRightPanelStore {
  isPanelOpen: boolean;
  activePanel: RightPanelView | null;
  /**
   * Depending on the responsive breakpoint, the panel can be auto-closed, and so
   * auto-opened later on.
   */
  wasAutoClosed: boolean;
  setActivePanel: (panel: RightPanelView | null) => void;
  setIsPanelOpen: (isOpen: boolean) => void;
  togglePanel: () => void;
  autoClose: () => void;
}

export const useRightPanelStore = create<UseRightPanelStore>((set) => ({
  isPanelOpen: false,
  activePanel: null,
  wasAutoClosed: false,
  setActivePanel: (activePanel) =>
    set(() => ({
      activePanel,
      isPanelOpen: activePanel !== null,
      wasAutoClosed: false,
    })),
  setIsPanelOpen: (isPanelOpen) =>
    set((state) => ({
      isPanelOpen,
      activePanel: isPanelOpen ? state.activePanel : null,
      wasAutoClosed: false,
    })),
  togglePanel: () =>
    set((state) => ({
      isPanelOpen: !state.isPanelOpen,
      wasAutoClosed: false,
    })),
  autoClose: () => set({ isPanelOpen: false, wasAutoClosed: true }),
}));
