import { terminateCrispSession } from '@/services/Crisp';

import { LOGIN_URL, LOGOUT_URL } from './conf';

export const gotoLogin = (returnTo = '/', isSilent = false) => {
  const authenticateUrl =
    LOGIN_URL +
    `?silent=${encodeURIComponent(isSilent)}&returnTo=${window.location.origin + returnTo}`;
  window.location.replace(authenticateUrl);
};

export const gotoLogout = () => {
  terminateCrispSession();
  window.location.replace(LOGOUT_URL);
};
