import { gotoLogin } from '@/features/auth';

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
  const currentPath = window.location.pathname;
  gotoLogin(currentPath, true);
};

export const canAttemptSilentLogin = () => {
  return isRetryAllowed();
};

export const attemptSilentLogin = (retryIntervalInSeconds: number) => {
  if (!isRetryAllowed()) {
    return;
  }
  setNextRetryTime(retryIntervalInSeconds);
  initiateSilentLogin();
};
