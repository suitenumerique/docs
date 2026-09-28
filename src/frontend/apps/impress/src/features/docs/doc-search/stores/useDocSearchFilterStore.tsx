import { create } from 'zustand';

import { DocSearchFilterTypes } from '../types';

export interface UseDocSearchFilterStore {
  filter: DocSearchFilterTypes;
  setFilter: (filter: DocSearchFilterTypes) => void;
}

const defaultState: Pick<UseDocSearchFilterStore, 'filter'> = {
  filter: 'all',
};

export const useDocSearchFilterStore = create<UseDocSearchFilterStore>(
  (set) => ({
    filter: defaultState.filter,
    setFilter: (filter) => {
      set({ filter });
    },
  }),
);
