import { terminateCrispSession } from '@/services/Crisp';
import { safeLocalStorage } from '@/utils/storages';

import {
  HOME_URL,
  LOGIN_URL,
  LOGOUT_URL,
  PATH_AUTH_LOCAL_STORAGE,
  SILENT_LOGIN_RETRY,
} from './conf';

/**
 * Get the stored auth URL from local storage
 */
export const getAuthUrl = () => {
  const path_auth = safeLocalStorage.getItem(PATH_AUTH_LOCAL_STORAGE);
  if (path_auth) {
    safeLocalStorage.removeItem(PATH_AUTH_LOCAL_STORAGE);
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
    safeLocalStorage.setItem(PATH_AUTH_LOCAL_STORAGE, window.location.href);
  }
};

export const gotoLogin = (withRedirect = true) => {
  if (withRedirect) {
    setAuthUrl();
  }

  window.location.replace(LOGIN_URL);
};

export const gotoSilentLogin = () => {
  // Already tried silent login, dont try again
  if (!hasTrySilent()) {
    const params = new URLSearchParams({
      silent: 'true',
      next: window.location.href,
    });

    safeLocalStorage.setItem(SILENT_LOGIN_RETRY, 'true');

    const REDIRECT = `${LOGIN_URL}?${params.toString()}`;
    window.location.replace(REDIRECT);
  }
};

export const hasTrySilent = () => {
  return !!safeLocalStorage.getItem(SILENT_LOGIN_RETRY);
};

export const resetSilent = () => {
  safeLocalStorage.removeItem(SILENT_LOGIN_RETRY);
};

export const gotoLogout = () => {
  terminateCrispSession();
  window.location.replace(LOGOUT_URL);
};
