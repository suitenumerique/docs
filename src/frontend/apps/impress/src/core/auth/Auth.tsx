import { Loader } from '@openfun/cunningham-react';
import { useRouter } from 'next/router';
import { PropsWithChildren, useEffect, useState } from 'react';

import { Box } from '@/components';

import { useAuthStore } from './useAuthStore';

/**
 * TODO: Remove this restriction when we will have a homepage design for non-authenticated users.
 *
 * We define the paths that are not allowed without authentication.
 * Actually, only the home page and the docs page are not allowed without authentication.
 * When we will have a homepage design for non-authenticated users, we will remove this restriction to have
 * the full website accessible without authentication.
 */
const regexpUrlsAuth = [/\/docs\/$/g];

export const Auth = ({ children }: PropsWithChildren) => {
  const { initAuth, initiated, authenticated, login } = useAuthStore();
  const { asPath } = useRouter();

  const [pathAllowed, setPathAllowed] = useState<boolean>(
    !regexpUrlsAuth.some((regexp) => !!asPath.match(regexp)),
  );

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    setPathAllowed(!regexpUrlsAuth.some((regexp) => !!asPath.match(regexp)));
  }, [asPath]);

  // We force to login except on allowed paths
  useEffect(() => {
    if (!initiated || authenticated || pathAllowed) {
      return;
    }

    login();
  }, [authenticated, pathAllowed, login, initiated]);

  if ((!initiated && pathAllowed) || (!authenticated && !pathAllowed)) {
    return (
      <Box $height="100vh" $width="100vw" $align="center" $justify="center">
        <Loader />
      </Box>
    );
  }

  return children;
};
