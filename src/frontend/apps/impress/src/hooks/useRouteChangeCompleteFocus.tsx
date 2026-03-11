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

    window.addEventListener('keydown', handleKeyboardNavigation);

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

        const prefersReducedMotion = window.matchMedia(
          '(prefers-reduced-motion: reduce)',
        ).matches;

        if (isKeyboardNavigationRef.current) {
          focusMainContentStart({ preventScroll: true });
          isKeyboardNavigationRef.current = false;
        }
        if (router.pathname === '/docs/[id]') {
          return;
        }
        focusTarget.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: 'start',
        });
      });
    };

    router.events.on('routeChangeComplete', handleRouteChangeComplete);
    return () => {
      window.removeEventListener('keydown', handleKeyboardNavigation);
      router.events.off('routeChangeComplete', handleRouteChangeComplete);
    };
  }, [router.events, router.pathname]);
};
