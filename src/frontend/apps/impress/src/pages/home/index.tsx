import { useRouter } from 'next/router';
import { useEffect } from 'react';

import { Loading } from '@/components';
import { useAuth } from '@/features/auth';
import { HomeContent } from '@/features/home';
import { NextPageWithLayout } from '@/types/next';

const Page: NextPageWithLayout = () => {
  const { authenticated } = useAuth();
  const { replace } = useRouter();

  /**
   * If the user is authenticated we redirect him to the index page (grid).
   */
  useEffect(() => {
    if (!authenticated) {
      return;
    }

    void replace('/');
  }, [authenticated, replace]);

  if (authenticated) {
    return <Loading $height="100vh" $width="100vw" />;
  }

  return <HomeContent />;
};

export default Page;
