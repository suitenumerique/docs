import { create } from 'zustand';

interface CommentSidebarStore {
  filter: 'open' | 'resolved';
  setFilter: (filter: 'open' | 'resolved') => void;
  setThreadsSidebarTarget: (el: HTMLElement | null) => void;
  threadsSidebarTarget: HTMLElement | null;
}

export const useCommentSidebarStore = create<CommentSidebarStore>((set) => ({
  filter: 'open',
  setFilter: (filter) => set(() => ({ filter })),
  setThreadsSidebarTarget: (threadsSidebarTarget) => {
    set(() => ({ threadsSidebarTarget }));
  },
  threadsSidebarTarget: null,
}));
