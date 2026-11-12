import { useEffect } from 'react';

import { getMainContentElement } from '@/layouts/utils';

const SCROLL_MARGIN_TOP = 50;
const OBSERVER_TIMEOUT = 5000;
const ALIGN_TIMEOUT = 5000;

// Any of these means the user took control of the scroll position.
const USER_EVENTS = ['wheel', 'touchstart', 'keydown', 'mousedown'] as const;

/**
 * Hook that scrolls to a block element based on the URL hash.
 * If the block element doesn't exist yet, it observes the DOM for a limited time
 * to see if it appears, and scrolls to it when it does.
 * Once scrolled, it keeps the block aligned for a limited time while the content
 * above it changes size (images and videos loading), until the user scrolls.
 */
export const useScrollToBlockAnchor = () => {
  useEffect(() => {
    const blockId = window.location.hash.slice(1);

    if (!blockId) {
      return;
    }

    let mutationObserver: MutationObserver | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let mutationTimeoutId: ReturnType<typeof setTimeout> | undefined;
    let alignTimeoutId: ReturnType<typeof setTimeout> | undefined;

    const stopAligning = () => {
      resizeObserver?.disconnect();
      clearTimeout(alignTimeoutId);
      USER_EVENTS.forEach((event) =>
        window.removeEventListener(event, stopAligning),
      );
    };

    /**
     * Media above the block load after the first scroll and push the block down.
     * Re-align each time a wrapper of the block changes size, until the timeout
     * or until the user scrolls or clicks.
     */
    const keepAligned = (blockEl: HTMLElement) => {
      const container = getMainContentElement();
      let isFirstCall = true;

      resizeObserver = new ResizeObserver(() => {
        // ResizeObserver fires once on observe(): ignore it so it doesn't
        // cut the initial smooth scroll short.
        if (isFirstCall) {
          isFirstCall = false;
          return;
        }
        const currentBlockEl = document.getElementById(blockId);
        if (currentBlockEl) {
          scrollBlockIntoView(currentBlockEl, 'auto');
        }
      });

      // Watch every wrapper between the block and the scrolling container:
      // when media above the block load, one of them grows.
      let element: HTMLElement | null = blockEl.parentElement;
      while (element && element !== container) {
        resizeObserver.observe(element);
        element = element.parentElement;
      }

      USER_EVENTS.forEach((event) =>
        window.addEventListener(event, stopAligning, { passive: true }),
      );
      alignTimeoutId = setTimeout(stopAligning, ALIGN_TIMEOUT);
    };

    const scrollAndKeepAligned = (blockEl: HTMLElement) => {
      scrollBlockIntoView(blockEl);
      keepAligned(blockEl);
    };

    const existingBlockEl = document.getElementById(blockId);
    if (existingBlockEl) {
      scrollAndKeepAligned(existingBlockEl);
    } else {
      /**
       * Document editor can be a bit slow to render the block elements.
       * If the block element doesn't exist yet, we observe the DOM
       * during the next OBSERVER_TIMEOUT milliseconds to see if it appears,
       * and scroll to it when it does.
       */
      mutationObserver = new MutationObserver(() => {
        const blockEl = document.getElementById(blockId);

        if (blockEl) {
          clearTimeout(mutationTimeoutId);
          mutationObserver?.disconnect();
          scrollAndKeepAligned(blockEl);
        }
      });

      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });

      // Disconnect the observer after a timeout if the block never appears
      mutationTimeoutId = setTimeout(() => {
        mutationObserver?.disconnect();
      }, OBSERVER_TIMEOUT);
    }

    return () => {
      clearTimeout(mutationTimeoutId);
      mutationObserver?.disconnect();
      stopAligning();
    };
  }, []);
};

// Try to scroll the main content container instead of the block itself
// to avoid the block being hidden behind the header
export const scrollBlockIntoView = (
  blockEl: HTMLElement,
  behavior: ScrollBehavior = 'smooth',
) => {
  const container = getMainContentElement();

  if (container) {
    const top =
      blockEl.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop -
      SCROLL_MARGIN_TOP;

    container.scrollTo({ top, behavior });
  } else {
    blockEl.scrollIntoView({
      behavior,
      inline: 'start',
      block: 'start',
    });
  }
};
