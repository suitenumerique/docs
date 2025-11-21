import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

import { Loading } from '@/components';
import { gotoLogin, useAuth } from '@/features/auth';
import { useCreateDoc } from '@/features/docs/doc-management';
import { useSkeletonStore } from '@/features/skeletons';
import { NextPageWithLayout } from '@/types/next';

const Page: NextPageWithLayout = () => {
  const router = useRouter();
  const { authenticated } = useAuth();
  const { setIsSkeletonVisible } = useSkeletonStore();
  const [isNavigating, setIsNavigating] = useState(false);
  const [hasCreated, setHasCreated] = useState(false);

  const { mutate: createDoc, isPending: isDocCreating } = useCreateDoc({
    onSuccess: (doc) => {
      setIsNavigating(true);
      setHasCreated(true);
      // Wait for navigation to complete
      router
        .replace(`/docs/${doc.id}`)
        .then(() => {
          // The skeleton will be disabled by the [id] page once the data is loaded
          setIsNavigating(false);
        })
        .catch(() => {
          // In case of navigation error, disable the skeleton
          setIsSkeletonVisible(false);
          setIsNavigating(false);
        });
    },
    onError: () => {
      // If there's an error, disable the skeleton
      setIsSkeletonVisible(false);
      setIsNavigating(false);
    },
  });

  /**
   * Redirect to login if user is not authenticated
   */
  useEffect(() => {
    // If not authenticated, redirect to login
    if (!authenticated) {
      gotoLogin();
      return;
    }
  }, [authenticated]);

  /**
   * Create a new document when the page is visited
   * Only create if user is authenticated
   */
  useEffect(() => {
    // Don't create if not authenticated (will be redirected)
    if (!authenticated) {
      return;
    }

    // Create document only if authenticated and not already created
    if (!hasCreated && !isDocCreating && !isNavigating) {
      setIsSkeletonVisible(true);
      createDoc();
    }
  }, [
    authenticated,
    hasCreated,
    isDocCreating,
    isNavigating,
    createDoc,
    setIsSkeletonVisible,
  ]);

  return <Loading />;
};

export default Page;
