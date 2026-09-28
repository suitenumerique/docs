import { create } from 'zustand';

interface UseFindReplaceStore {
  isOpen: boolean;
  /**
   * `openCount` gives us a way to rerender the FindReplace
   * component when it is opened multiple times in a row.  
   * We use this to reset the input fields when the user
   * opens the panel again.
   */
  openCount: number;
  open: () => void;
  close: () => void;
}

export const useFindReplaceStore = create<UseFindReplaceStore>((set) => ({
  isOpen: false,
  openCount: 0,
  open: () =>
    set((state) => ({ isOpen: true, openCount: state.openCount + 1 })),
  close: () => set({ isOpen: false }),
}));
