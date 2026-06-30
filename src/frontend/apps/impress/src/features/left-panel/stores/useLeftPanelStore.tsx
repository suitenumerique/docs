import { create } from 'zustand';

import {
  MOBILE_BREAKPOINT,
  useResponsiveStore,
} from '@/stores/useResponsiveStore';

interface LeftPanelState {
  isPanelOpen: boolean;
  /**
   * Depending on the responsive breakpoint, the panel can be auto-closed, and so
   * auto-opened later on.
   */
  wasAutoClosed: boolean;
  togglePanel: () => void;
  closePanel: () => void;
  autoClose: () => void;
}

const isMobileOnInit = () =>
  typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT;

export const useLeftPanelStore = create<LeftPanelState>((set, get) => ({
  isPanelOpen: !isMobileOnInit(),
  wasAutoClosed: false,
  togglePanel: () => {
    const { isPanelOpen } = get();
    set({ isPanelOpen: !isPanelOpen, wasAutoClosed: false });
  },
  closePanel: () => {
    set({ isPanelOpen: false, wasAutoClosed: false });
  },
  autoClose: () => set({ isPanelOpen: false, wasAutoClosed: true }),
}));

// Close the panel automatically whenever the responsive store switches to mobile.
useResponsiveStore.subscribe((state, prevState) => {
  if (state.isMobile && !prevState.isMobile) {
    useLeftPanelStore.getState().autoClose();
  }

  if (!state.isTablet && !prevState.isTablet) {
    useLeftPanelStore.setState({ isPanelOpen: true, wasAutoClosed: false });
  }
});
