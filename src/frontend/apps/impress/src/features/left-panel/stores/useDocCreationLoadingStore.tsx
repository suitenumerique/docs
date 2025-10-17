import { create } from 'zustand';

interface DocCreationLoadingStore {
  isCreatingDoc: boolean;
  setIsCreatingDoc: (isCreating: boolean) => void;
}

export const useDocCreationLoadingStore = create<DocCreationLoadingStore>(
  (set) => ({
    isCreatingDoc: false,
    setIsCreatingDoc: (isCreating: boolean) =>
      set({ isCreatingDoc: isCreating }),
  }),
);
