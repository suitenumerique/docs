import { useEffect, useState } from 'react';

import { SKELETON_FADE_DURATION_MS } from '../components/DocEditorSkeleton';

export const useSkeletonFadeOut = (showContent: boolean) => {
  const [skeletonVisible, setSkeletonVisible] = useState(!showContent);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    if (showContent) {
      setIsFadingOut(true);
      const timer = setTimeout(
        () => setSkeletonVisible(false),
        SKELETON_FADE_DURATION_MS,
      );
      return () => clearTimeout(timer);
    } else {
      setSkeletonVisible(true);
      setIsFadingOut(false);
    }
  }, [showContent]);

  return { skeletonVisible, isFadingOut };
};
