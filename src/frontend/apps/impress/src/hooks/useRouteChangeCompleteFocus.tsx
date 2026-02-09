import { useRouter } from 'next/router';
import { useEffect, useRef } from 'react';

import { MAIN_LAYOUT_ID } from '@/layouts/conf';

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
        const mainContent =
          document.getElementById(MAIN_LAYOUT_ID) ??
          document.getElementsByTagName('main')[0];

        if (!mainContent) {
          return;
        }

        const firstHeading = mainContent.querySelector('h1, h2, h3');
        const prefersReducedMotion = window.matchMedia(
          '(prefers-reduced-motion: reduce)',
        ).matches;

        if (isKeyboardNavigationRef.current) {
          (mainContent as HTMLElement | null)?.focus({ preventScroll: true });
          isKeyboardNavigationRef.current = false;
        }
        if (router.pathname === '/docs/[id]') {
          return;
        }
        (firstHeading ?? mainContent)?.scrollIntoView({
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
