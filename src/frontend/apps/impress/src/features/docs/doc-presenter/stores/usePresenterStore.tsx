import { create } from 'zustand';

export interface PresenterState {
  isOpen: boolean;
  /** 0-based slide to start the presentation on. */
  initialIndex: number;
  open: (index?: number) => void;
  close: () => void;
}

export const usePresenterStore = create<PresenterState>((set) => ({
  isOpen: false,
  initialIndex: 0,
  open: (index = 0) => {
    set({ isOpen: true, initialIndex: Math.max(0, index) });
  },
  close: () => {
    set({ isOpen: false });
  },
}));
