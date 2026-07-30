import { useEffect } from 'react';

import { getMainContentElement } from '@/layouts/utils';

const SCROLL_MARGIN_TOP = 50;
const OBSERVER_TIMEOUT = 5000;

/**
 * Hook that scrolls to a block element based on the URL hash.
 * If the block element doesn't exist yet, it observes the DOM for a limited time
 * to see if it appears, and scrolls to it when it does.
 * If it doesn't appear within that time, it stops observing to avoid memory leaks.
 */
export const useScrollToBlockAnchor = () => {
  useEffect(() => {
    const blockId = window.location.hash.slice(1);

    if (!blockId) {
      return;
    }

    const existingBlockEl = document.getElementById(blockId);
    if (existingBlockEl) {
      scrollBlockIntoView(existingBlockEl);
      return;
    }

    /**
     * Document editor can be a bit slow to render the block elements.
     * If the block element doesn't exist yet, we observe the DOM
     * during the next OBSERVER_TIMEOUT milliseconds to see if it appears,
     * and scroll to it when it does.
     * If it doesn't appear within that time, we stop observing to avoid memory leaks.
     */
    const observer = new MutationObserver(() => {
      const blockEl = document.getElementById(blockId);

      if (blockEl) {
        clearTimeout(timeoutId);
        observer.disconnect();
        scrollBlockIntoView(blockEl);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Disconnect the observer after a timeout to avoid memory leaks if the block never appears
    const timeoutId = setTimeout(() => {
      observer.disconnect();
    }, OBSERVER_TIMEOUT);

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, []);
};

// Try to scroll the main content container instead of the block itself
// to avoid the block being hidden behind the header
export const scrollBlockIntoView = (blockEl: HTMLElement) => {
  const container = getMainContentElement();

  if (container) {
    const top =
      blockEl.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop -
      SCROLL_MARGIN_TOP;

    container.scrollTo({ top, behavior: 'smooth' });
  } else {
    blockEl.scrollIntoView({
      behavior: 'smooth',
      inline: 'start',
      block: 'start',
    });
  }
};
