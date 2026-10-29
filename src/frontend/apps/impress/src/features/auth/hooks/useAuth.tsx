import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';

import { useAnalytics } from '@/libs';

import { useAuthQuery } from '../api';

const regexpUrlsAuth = [/\/docs\/$/g, /\/docs$/g, /^\/$/g];

export const useAuth = () => {
  const {
    data: user,
    error,
    isError,
    isFetched,
    isLoading,
    isSuccess,
  } = useAuthQuery();
  const { pathname } = useRouter();
  const { trackEvent } = useAnalytics();
  const [hasTracked, setHasTracked] = useState(isFetched);
  const isAuthLoading = isLoading;

  const hasInitiallyLoaded = useRef(false);
  if (isFetched) {
    hasInitiallyLoaded.current = true;
  }
  const [pathAllowed, setPathAllowed] = useState<boolean>(
    !regexpUrlsAuth.some((regexp) => !!pathname.match(regexp)),
  );

  useEffect(() => {
    setPathAllowed(!regexpUrlsAuth.some((regexp) => !!pathname.match(regexp)));
  }, [pathname]);

  useEffect(() => {
    if (!hasTracked && user && isSuccess) {
      trackEvent({
        eventName: 'user',
        id: user?.id || '',
        email: user?.email || '',
      });
      setHasTracked(true);
    }
  }, [hasTracked, isSuccess, user, trackEvent]);

  return {
    user,
    // A failed refetch keeps the cached user: the query is in error, but the
    // user is still logged in. A logout answers a 401, and getMe returns null.
    authenticated: !!user,
    pathAllowed,
    hasInitiallyLoaded: hasInitiallyLoaded.current,
    isAuthLoading,
    // Likewise, only a user that could not be loaded at all is an error.
    authError: isError && !user ? error : undefined,
  };
};
