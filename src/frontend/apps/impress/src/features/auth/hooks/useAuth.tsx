import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

import { useAuthQuery } from '../api';
import { getAuthUrl } from '../utils';

const regexpUrlsAuth = [/\/docs\/$/g, /\/docs$/g, /^\/$/g];

export const useAuth = () => {
  const { data: user, ...authStates } = useAuthQuery();
  const { pathname, replace } = useRouter();

  const [pathAllowed, setPathAllowed] = useState<boolean>(
    !regexpUrlsAuth.some((regexp) => !!pathname.match(regexp)),
  );

  useEffect(() => {
    setPathAllowed(!regexpUrlsAuth.some((regexp) => !!pathname.match(regexp)));
  }, [pathname]);

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
