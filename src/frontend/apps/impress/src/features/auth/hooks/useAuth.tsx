import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

import { useAnalytics } from '@/libs';

import { useAuthQuery } from '../api';
import { getAuthUrl } from '../utils';

const regexpUrlsAuth = [/\/docs\/$/g, /\/docs$/g, /^\/$/g];

export const useAuth = () => {
  const { data: user, ...authStates } = useAuthQuery();
  const { pathname, replace } = useRouter();
  const { trackEvent } = useAnalytics();
  const [pathAllowed, setPathAllowed] = useState<boolean>(
    !regexpUrlsAuth.some((regexp) => !!pathname.match(regexp)),
  );

  useEffect(() => {
    setPathAllowed(!regexpUrlsAuth.some((regexp) => !!pathname.match(regexp)));
  }, [pathname]);

  const [hasTracked, setHasTracked] = useState(authStates.isFetched);

  useEffect(() => {
    if (!hasTracked && user && authStates.isSuccess) {
      trackEvent({
        eventName: 'user',
        id: user?.id || '',
        email: user?.email || '',
      });
      setHasTracked(true);
    }
  }, [hasTracked, authStates.isSuccess, user, trackEvent]);

  // Redirect to the path before login
  useEffect(() => {
    if (!user) {
      return;
    }

    const authUrl = getAuthUrl();
    if (authUrl) {
      void replace(authUrl);
    }
  }, [user, replace]);

  return { user, authenticated: !!user, pathAllowed, ...authStates };
};
