import { create } from 'zustand';

interface UseFocusStore {
  lastFocusedElement: HTMLElement | null;
  addLastFocus: (target: HTMLElement | null) => void;
  restoreFocus: () => void;
}

export const useFocusStore = create<UseFocusStore>((set, get) => ({
  lastFocusedElement: null,
  addLastFocus: (target) => set({ lastFocusedElement: target }),
  restoreFocus: () => {
    const { lastFocusedElement } = get();
    if (!lastFocusedElement) {
      return;
    }

    requestAnimationFrame(() => {
      lastFocusedElement.focus();
    });
    set({ lastFocusedElement: null });
  },
}));
