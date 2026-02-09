import { create } from 'zustand';

interface LeftPanelState {
  isPanelOpen: boolean;
  isPanelOpenMobile: boolean;
  togglePanel: (value?: boolean) => void;
  closePanel: () => void;
}

export const useLeftPanelStore = create<LeftPanelState>((set, get) => ({
  isPanelOpen: true,
  isPanelOpenMobile: false,
  togglePanel: (value?: boolean) => {
    if (value === true) {
      set({ isPanelOpen: true });
      return;
    }
    if (value === false) {
      set({ isPanelOpen: false, isPanelOpenMobile: false });
      return;
    }
    const { isPanelOpen, isPanelOpenMobile } = get();
    set({
      isPanelOpen: !isPanelOpen,
      isPanelOpenMobile: !isPanelOpenMobile,
    });
  },
  closePanel: () => {
    set({ isPanelOpen: false, isPanelOpenMobile: false });
  },
}));
