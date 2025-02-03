import { Loader } from '@openfun/cunningham-react';
import { useRouter } from 'next/router';
import { PropsWithChildren } from 'react';

import { Box } from '@/components';

import { useAuth } from '../hooks';

export const Auth = ({ children }: PropsWithChildren) => {
  const { isLoading, pathAllowed, isFetchedAfterMount, authenticated } =
    useAuth();
  const { replace, pathname } = useRouter();

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
    void replace('/login');
    return (
      <Box $height="100vh" $width="100vw" $align="center" $justify="center">
        <Loader />
      </Box>
    );
  }

  /**
   * If the user is authenticated and the path is the login page, we redirect to the home page.
   */
  if (pathname === '/login' && authenticated) {
    void replace('/');
    return (
      <Box $height="100vh" $width="100vw" $align="center" $justify="center">
        <Loader />
      </Box>
    );
  }

  return children;
};
