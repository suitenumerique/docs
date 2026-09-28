import { useRouter } from 'next/router';
import { PropsWithChildren, useEffect, useMemo, useState } from 'react';

import { Loading } from '@/components';
import { useConfig } from '@/core';

import { HOME_URL } from '../conf';
import { useAuth } from '../hooks';
import {
  getAuthUrl,
  gotoLogin,
  gotoSilentLogin,
  hasTrySilent,
  resetSilent,
} from '../utils';

import { FirstConnection } from './FirstConnection';

export const Auth = ({ children }: PropsWithChildren) => {
  const {
    isAuthLoading,
    pathAllowed,
    authenticated,
    hasInitiallyLoaded,
    user,
  } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const { data: config } = useConfig();
  const shouldTrySilentLogin = useMemo(
    () =>
      !authenticated &&
      !hasTrySilent() &&
      !isAuthLoading &&
      !isRedirecting &&
      config?.FRONTEND_SILENT_LOGIN_ENABLED,
    [
      authenticated,
      isAuthLoading,
      isRedirecting,
      config?.FRONTEND_SILENT_LOGIN_ENABLED,
    ],
  );
  const shouldTryLogin =
    !authenticated && !isAuthLoading && !isRedirecting && !pathAllowed;
  const { replace, pathname } = useRouter();

  /**
   * If the user is authenticated and initially wanted to access a specific page, redirect him to that page now.
   */
  useEffect(() => {
    if (!authenticated || isRedirecting) {
      return;
    }

    if (hasTrySilent()) {
      resetSilent();
    }

    const authUrl = getAuthUrl();
    if (authUrl) {
      setIsRedirecting(true);
      void replace(authUrl).then(() => setIsRedirecting(false));
    }
  }, [authenticated, isRedirecting, pathname, replace]);

  /**
   * If the user is not authenticated and not on a allowed pages
   */
  useEffect(() => {
    if (shouldTrySilentLogin) {
      setIsRedirecting(true);
      gotoSilentLogin();
      return;
    }

    if (!shouldTryLogin) {
      return;
    }

    /**
     * The homepage feature is enabled, redirect them to the homepage
     */
    if (config?.FRONTEND_HOMEPAGE_FEATURE_ENABLED) {
      if (pathname !== HOME_URL) {
        setIsRedirecting(true);
        window.location.replace(HOME_URL);
      }

      return;
    }

    /**
     * Redirect them to login page
     */
    setIsRedirecting(true);
    gotoLogin();
  }, [
    config?.FRONTEND_HOMEPAGE_FEATURE_ENABLED,
    pathname,
    shouldTryLogin,
    shouldTrySilentLogin,
  ]);

  const shouldShowLoader =
    !hasInitiallyLoaded ||
    isRedirecting ||
    (!authenticated && !pathAllowed) ||
    shouldTrySilentLogin;

  if (shouldShowLoader) {
    return <Loading $height="100vh" $width="100vw" />;
  }

  return (
    <>
      {children}
      {user && user.is_first_connection && <FirstConnection />}
    </>
  );
};
