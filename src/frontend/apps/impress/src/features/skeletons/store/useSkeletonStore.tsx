import { create } from 'zustand';

interface SkeletonStore {
  isSkeletonVisible: boolean;
  setIsSkeletonVisible: (isSkeletonVisible: boolean) => void;
}

export const useSkeletonStore = create<SkeletonStore>((set) => ({
  isSkeletonVisible: false,
  setIsSkeletonVisible: (isSkeletonVisible: boolean) =>
    set({ isSkeletonVisible }),
}));
