import { create } from 'zustand';

type TogglePanelType = { type: 'desktop' | 'mobile' };

type TogglePanelArgs = {
  value?: boolean;
} & Partial<TogglePanelType>;

interface LeftPanelState {
  isPanelOpen: boolean;
  isPanelOpenMobile: boolean;
  togglePanel: (args?: TogglePanelArgs) => void;
  closePanel: (args?: TogglePanelType) => void;
}

export const useLeftPanelStore = create<LeftPanelState>((set, get) => ({
  isPanelOpen: true,
  isPanelOpenMobile: false,
  togglePanel: ({ value, type }: TogglePanelArgs = {}) => {
    if (typeof value === 'boolean') {
      if (type === 'mobile') {
        set({ isPanelOpenMobile: value });
        return;
      }
      if (type === 'desktop') {
        set({ isPanelOpen: value });
        return;
      }
      set({ isPanelOpen: value, isPanelOpenMobile: value });
      return;
    }

    const { isPanelOpen, isPanelOpenMobile } = get();
    if (type === 'mobile') {
      set({ isPanelOpenMobile: !isPanelOpenMobile });
      return;
    }
    if (type === 'desktop') {
      set({ isPanelOpen: !isPanelOpen });
      return;
    }
    set({ isPanelOpen: !isPanelOpen, isPanelOpenMobile: !isPanelOpenMobile });
  },
  closePanel: ({ type }: Partial<TogglePanelType> = {}) => {
    if (type === 'mobile') {
      set({ isPanelOpenMobile: false });
      return;
    }
    if (type === 'desktop') {
      set({ isPanelOpen: false });
      return;
    }
    set({ isPanelOpen: false, isPanelOpenMobile: false });
  },
}));
