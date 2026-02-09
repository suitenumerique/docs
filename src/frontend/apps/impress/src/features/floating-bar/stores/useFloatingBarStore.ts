import { create } from 'zustand';

interface FloatingBarState {
  isDocHeaderVisible: boolean;
  setIsDocHeaderVisible: (visible: boolean) => void;
}

export const useFloatingBarStore = create<FloatingBarState>((set) => ({
  isDocHeaderVisible: true,
  setIsDocHeaderVisible: (visible) => {
    set({ isDocHeaderVisible: visible });
  },
}));
