import { useRouter } from 'next/router';
import { PropsWithChildren, useEffect, useState } from 'react';

import { Loading } from '@/components';
import { useConfig } from '@/core';

import { HOME_URL } from '../conf';
import { useAuth } from '../hooks';
import { getAuthUrl, gotoLogin } from '../utils';

export const Auth = ({ children }: PropsWithChildren) => {
  const { isLoading, pathAllowed, isFetchedAfterMount, authenticated } =
    useAuth();
  const { replace, pathname } = useRouter();
  const { data: config } = useConfig();
  const [isRedirecting, setIsRedirecting] = useState(false);

  /**
   * If the user is authenticated and initially wanted to access a specific page, redirect him to that page now.
   */
  useEffect(() => {
    if (!authenticated || isRedirecting) {
      return;
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
    if (isLoading || authenticated || pathAllowed || isRedirecting) {
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
    authenticated,
    pathAllowed,
    config?.FRONTEND_HOMEPAGE_FEATURE_ENABLED,
    replace,
    isLoading,
    isRedirecting,
    pathname,
  ]);

  const shouldShowLoader =
    (isLoading && !isFetchedAfterMount) ||
    isRedirecting ||
    (!authenticated && !pathAllowed);

  if (shouldShowLoader) {
    return <Loading $height="100vh" $width="100vw" />;
  }

  return children;
};
