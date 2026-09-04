import { useRouter } from 'next/router';
import { useEffect, useRef } from 'react';

import {
  focusMainContentStart,
  getMainContentFocusTarget,
} from '@/layouts/utils';

export const useRouteChangeCompleteFocus = () => {
  const router = useRouter();
  const lastCompletedPathRef = useRef<string | null>(null);
  const isKeyboardNavigationRef = useRef(false);

  useEffect(() => {
    const handleKeyboardNavigation = (event: KeyboardEvent) => {
      if (['Tab', 'Enter', ' ', 'Spacebar'].includes(event.key)) {
        isKeyboardNavigationRef.current = true;
      }
    };

    // Otherwise a space typed in the editor makes the next click on a document
    // move the focus into the content.
    const handlePointerNavigation = () => {
      isKeyboardNavigationRef.current = false;
    };

    window.addEventListener('keydown', handleKeyboardNavigation);
    window.addEventListener('pointerdown', handlePointerNavigation);

    const handleRouteChangeComplete = (url: string) => {
      const normalizedUrl = url.split('#')[0];
      if (lastCompletedPathRef.current === normalizedUrl) {
        return;
      }
      lastCompletedPathRef.current = normalizedUrl;

      requestAnimationFrame(() => {
        const focusTarget = getMainContentFocusTarget();

        if (!focusTarget) {
          return;
        }

        if (isKeyboardNavigationRef.current) {
          focusMainContentStart({ preventScroll: true });
          isKeyboardNavigationRef.current = false;
        }
      });
    };

    router.events.on('routeChangeComplete', handleRouteChangeComplete);
    return () => {
      window.removeEventListener('keydown', handleKeyboardNavigation);
      window.removeEventListener('pointerdown', handlePointerNavigation);
      router.events.off('routeChangeComplete', handleRouteChangeComplete);
    };
  }, [router.events, router.pathname]);
};
