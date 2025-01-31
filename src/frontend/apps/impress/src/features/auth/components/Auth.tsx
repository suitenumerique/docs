import { Loader } from '@openfun/cunningham-react';
import { PropsWithChildren } from 'react';

import { Box } from '@/components';
import HomeContent from '@/features/home/components/HomeContent';

import { useAuth } from '../hooks';

/**
 * TODO: Remove this restriction when we will have a homepage design for non-authenticated users.
 *
 * We define the paths that are not allowed without authentication.
 * Actually, only the home page and the docs page are not allowed without authentication.
 * When we will have a homepage design for non-authenticated users, we will remove this restriction to have
 * the full website accessible without authentication.
 */
export const Auth = ({ children }: PropsWithChildren) => {
  const { user, isLoading, pathAllowed } = useAuth();

  if (isLoading) {
    return (
      <Box $height="100vh" $width="100vw" $align="center" $justify="center">
        <Loader />
      </Box>
    );
  }

  return children;
};
