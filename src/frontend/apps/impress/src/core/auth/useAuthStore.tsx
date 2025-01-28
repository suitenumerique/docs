import { create } from 'zustand';

import { baseApiUrl } from '@/api';
import { terminateCrispSession } from '@/services';

import { User, getMe } from './api';
import { PATH_AUTH_LOCAL_STORAGE } from './conf';

interface AuthStore {
  initiated: boolean;
  authenticated: boolean;
  initAuth: () => void;
  logout: () => void;
  login: () => void;
  setAuthUrl: (url: string) => void;
  getAuthUrl: () => string | undefined;
  userData?: User;
}

const initialState = {
  initiated: false,
  authenticated: false,
  userData: undefined,
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  initiated: initialState.initiated,
  authenticated: initialState.authenticated,
  userData: initialState.userData,
  initAuth: () => {
    getMe()
      .then((data: User) => {
        set({ authenticated: true, userData: data });
      })
      .catch(() => {})
      .finally(() => {
        set({ initiated: true });
      });
  },
  login: () => {
    get().setAuthUrl(window.location.pathname);

    window.location.replace(`${baseApiUrl()}authenticate/`);
  },
  logout: () => {
    terminateCrispSession();
    window.location.replace(`${baseApiUrl()}logout/`);
  },
  // If we try to access a specific page, and we are not authenticated
  // we store the path in the local storage to redirect to it after log in
  setAuthUrl() {
    if (window.location.pathname !== '/') {
      localStorage.setItem(PATH_AUTH_LOCAL_STORAGE, window.location.pathname);
    }
  },
  // If a path is stored in the local storage, we return it then remove it
  getAuthUrl() {
    const path_auth = localStorage.getItem(PATH_AUTH_LOCAL_STORAGE);
    if (path_auth) {
      localStorage.removeItem(PATH_AUTH_LOCAL_STORAGE);
      return path_auth;
    }
  },
}));
