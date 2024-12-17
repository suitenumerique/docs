import { create } from 'zustand';

interface LeftPanelState {
  isPanelOpen: boolean;
  togglePanel: (value?: boolean) => void;
}

export const useLeftPanelStore = create<LeftPanelState>((set, get) => ({
  isPanelOpen: false,
  togglePanel: (value?: boolean) => {
    const sanitizedValue =
      value !== undefined && typeof value === 'boolean'
        ? value
        : !get().isPanelOpen;

    set({ isPanelOpen: sanitizedValue });
  },
}));
