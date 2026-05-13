import { create } from 'zustand';

interface CommentSidebarStore {
  filter: 'open' | 'resolved';
  isSideBarOpen: boolean;
  setIsSideBarOpen: (isSideBarOpen: boolean) => void;
  setThreadsSidebarTarget: (el: HTMLElement | null) => void;
  setFilter: (filter: 'open' | 'resolved') => void;
  threadsSidebarTarget: HTMLElement | null;
}

export const useCommentSidebarStore = create<CommentSidebarStore>((set) => ({
  filter: 'open',
  isSideBarOpen: false,
  setFilter: (filter) => set(() => ({ filter })),
  setIsSideBarOpen: (isSideBarOpen) => set(() => ({ isSideBarOpen })),
  setThreadsSidebarTarget: (threadsSidebarTarget) => {
    set(() => ({ threadsSidebarTarget }));
  },
  threadsSidebarTarget: null,
}));
