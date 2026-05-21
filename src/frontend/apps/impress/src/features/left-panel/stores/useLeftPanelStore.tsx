import { create } from 'zustand';

type TogglePanelType = { type: 'desktop' | 'mobile' };

type TogglePanelArgs = {
  value?: boolean;
} & Partial<TogglePanelType>;

interface LeftPanelState {
  isPanelOpen: boolean;
  isPanelOpenMobile: boolean;
  /**
   * Depending on the responsive breakpoint, the panel can be auto-closed, and so
   * auto-opened later on.
   */
  wasAutoClosed: boolean;
  togglePanel: (args?: TogglePanelArgs) => void;
  closePanel: (args?: TogglePanelType) => void;
  autoClose: () => void;
}

export const useLeftPanelStore = create<LeftPanelState>((set, get) => ({
  isPanelOpen: true,
  isPanelOpenMobile: false,
  wasAutoClosed: false,
  togglePanel: ({ value, type }: TogglePanelArgs = {}) => {
    set({ wasAutoClosed: false });
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
    set({ wasAutoClosed: false });
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
  autoClose: () => set({ isPanelOpen: false, wasAutoClosed: true }),
}));
