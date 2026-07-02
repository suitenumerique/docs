import { useEffect, useRef, useState } from 'react';

import { getMainContentElement } from '@/layouts/utils';

const SCROLL_THRESHOLD = 10;

/**
 * Tracks the scroll direction of the main content area and returns
 * whether an element bound to it should be visible: true when scrolling
 * up (or at the top), false when scrolling down.
 */
export const useHideOnScroll = () => {
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollTop = useRef(0);

  useEffect(() => {
    const scrollElement = getMainContentElement();
    if (!scrollElement) {
      return;
    }

    const handleScroll = () => {
      const scrollTop = scrollElement.scrollTop;
      const delta = scrollTop - lastScrollTop.current;

      if (Math.abs(delta) < SCROLL_THRESHOLD) {
        return;
      }

      setIsVisible(scrollTop <= 0 || delta < 0);
      lastScrollTop.current = scrollTop;
    };

    scrollElement.addEventListener('scroll', handleScroll, { passive: true });

    return () => scrollElement.removeEventListener('scroll', handleScroll);
  }, []);

  return isVisible;
};
