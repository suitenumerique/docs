import { Loader } from '@openfun/cunningham-react';
import { useRouter } from 'next/router';
import { PropsWithChildren } from 'react';

import { Box } from '@/components';
import { useConfig } from '@/core';

import { HOME_URL } from '../conf';
import { useAuth } from '../hooks';
import { gotoLogin } from '../utils';

export const Auth = ({ children }: PropsWithChildren) => {
  const { isLoading, pathAllowed, isFetchedAfterMount, authenticated } =
    useAuth();
  const { replace, pathname } = useRouter();
  const { data: config } = useConfig();

  if (isLoading && !isFetchedAfterMount) {
    return (
      <Box $height="100vh" $width="100vw" $align="center" $justify="center">
        <Loader />
      </Box>
    );
  }

  /**
   * If the user is not authenticated and the path is not allowed, we redirect to the login page.
   */
  if (!authenticated && !pathAllowed) {
    if (config?.FRONTEND_HOMEPAGE_FEATURE_ENABLED) {
      void replace(HOME_URL);
    } else {
      gotoLogin();
    }
    return (
      <Box $height="100vh" $width="100vw" $align="center" $justify="center">
        <Loader />
      </Box>
    );
  }

  /**
   * If the user is authenticated and the path is the home page, we redirect to the index.
   */
  if (pathname === HOME_URL && authenticated) {
    void replace('/');
    return (
      <Box $height="100vh" $width="100vw" $align="center" $justify="center">
        <Loader />
      </Box>
    );
  }

  return children;
};
