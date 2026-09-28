import { create } from 'zustand';

export interface PresenterState {
  isOpen: boolean;
  /** 0-based slide to start the presentation on. */
  initialSlideIndex: number;
  open: (index?: number) => void;
  close: () => void;
}

export const usePresenterStore = create<PresenterState>((set) => ({
  isOpen: false,
  initialSlideIndex: 0,
  open: (index = 0) => {
    const safeSlideIndex = Number.isFinite(index)
      ? Math.max(0, Math.trunc(index))
      : 0;
    set({ isOpen: true, initialSlideIndex: safeSlideIndex });
  },
  close: () => {
    set({ isOpen: false });
  },
}));
