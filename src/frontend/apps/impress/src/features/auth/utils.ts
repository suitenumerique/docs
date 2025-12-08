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

// Silent login utilities
const SILENT_LOGIN_RETRY_KEY = 'silent-login-retry';

const isRetryAllowed = () => {
  const lastRetryDate = localStorage.getItem(SILENT_LOGIN_RETRY_KEY);
  if (!lastRetryDate) {
    return true;
  }
  const now = new Date();
  return now.getTime() > Number(lastRetryDate);
};

const setNextRetryTime = (retryIntervalInSeconds: number) => {
  const now = new Date();
  const nextRetryTime = now.getTime() + retryIntervalInSeconds * 1000;
  localStorage.setItem(SILENT_LOGIN_RETRY_KEY, String(nextRetryTime));
};

const initiateSilentLogin = () => {
  const returnTo = window.location.href;
  window.location.replace(
    `${LOGIN_URL}?silent=true&returnTo=${encodeURIComponent(returnTo)}`,
  );
};

/**
 * Check if silent login retry is allowed based on the last attempt timestamp.
 */
export const canAttemptSilentLogin = () => {
  return isRetryAllowed();
};

/**
 * Attempt silent login if retry is allowed.
 * Sets a retry interval to prevent infinite loops.
 *
 * @param retryIntervalInSeconds - Minimum seconds between retry attempts (default: 30)
 */
export const attemptSilentLogin = (retryIntervalInSeconds: number) => {
  if (!isRetryAllowed()) {
    return;
  }
  setNextRetryTime(retryIntervalInSeconds);
  initiateSilentLogin();
};
