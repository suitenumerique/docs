import { terminateCrispSession } from '@/services/Crisp';

import { LOGIN_URL, LOGOUT_URL, PATH_AUTH_LOCAL_STORAGE } from './conf';

export const getAuthUrl = () => {
  const path_auth = localStorage.getItem(PATH_AUTH_LOCAL_STORAGE);
  if (path_auth) {
    localStorage.removeItem(PATH_AUTH_LOCAL_STORAGE);
    return path_auth;
  }
};

export const setAuthUrl = () => {
  if (window.location.pathname !== '/') {
    localStorage.setItem(PATH_AUTH_LOCAL_STORAGE, window.location.pathname);
  }
};

export const gotoLogin = (withRedirect = true) => {
  if (withRedirect) {
    setAuthUrl();
  }

  window.location.replace(LOGIN_URL);
};

export const gotoLogout = () => {
  terminateCrispSession();
  window.location.replace(LOGOUT_URL);
};
