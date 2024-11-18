import { create } from 'zustand';

interface LeftPanelState {
  isPanelOpen: boolean;
  togglePanel: () => void;
}

export const useLeftPanelStore = create<LeftPanelState>((set) => ({
  isPanelOpen: false,
  togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),
}));
