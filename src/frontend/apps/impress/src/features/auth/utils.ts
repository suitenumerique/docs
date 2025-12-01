import { terminateCrispSession } from '@/services/Crisp';

import {
  HOME_URL,
  LOGIN_URL,
  LOGOUT_URL,
  PATH_AUTH_LOCAL_STORAGE,
} from './conf';

/**
 * Get the stored auth URL from local storage
 */
export const getAuthUrl = () => {
  const path_auth = localStorage.getItem(PATH_AUTH_LOCAL_STORAGE);
  if (path_auth) {
    localStorage.removeItem(PATH_AUTH_LOCAL_STORAGE);
    return path_auth;
  }
};

/**
 * Store the current path in local storage if it's not the homepage or root
 * so we can redirect the user to this path after login
 */
export const setAuthUrl = () => {
  if (
    window.location.pathname !== '/' &&
    window.location.pathname !== `${HOME_URL}/`
  ) {
    localStorage.setItem(PATH_AUTH_LOCAL_STORAGE, window.location.href);
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
