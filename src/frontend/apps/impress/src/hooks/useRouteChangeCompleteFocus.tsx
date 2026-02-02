import { useRouter } from 'next/router';
import { useEffect } from 'react';

import { MAIN_LAYOUT_ID } from '@/layouts/conf';

export const useRouteChangeCompleteFocus = () => {
  const router = useRouter();

  useEffect(() => {
    const handleRouteChangeComplete = () => {
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

        (mainContent as HTMLElement | null)?.focus({ preventScroll: true });
        (firstHeading ?? mainContent)?.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: 'start',
        });
      });
    };

    router.events.on('routeChangeComplete', handleRouteChangeComplete);
    return () => {
      router.events.off('routeChangeComplete', handleRouteChangeComplete);
    };
  }, [router.events]);
};
