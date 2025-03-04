import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

import { useAuthQuery } from '../api';

const regexpUrlsAuth = [/\/docs\/$/g, /\/docs$/g, /^\/$/g];

export const useAuth = () => {
  const { data: user, ...authStates } = useAuthQuery();
  const { pathname } = useRouter();

  const [pathAllowed, setPathAllowed] = useState<boolean>(
    !regexpUrlsAuth.some((regexp) => !!pathname.match(regexp)),
  );

  useEffect(() => {
    setPathAllowed(!regexpUrlsAuth.some((regexp) => !!pathname.match(regexp)));
  }, [pathname]);

  return {
    user,
    authenticated: !!user && authStates.isSuccess,
    pathAllowed,
    ...authStates,
  };
};
