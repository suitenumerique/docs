import Router from 'next/router';
import { useEffect } from 'react';

import { getMainContentElement } from '@/layouts/utils';

import { getDocLink } from '../utils';

const SCROLL_MARGIN_TOP = 50;
const OBSERVER_TIMEOUT = 5000;
const HIGHLIGHT_DURATION = 1500;
export const BLOCK_HIGHLIGHT_CLASS = '--docs--block-highlighted';

const scrollPositions = new Map<string, number>();

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

  useEffect(() => {
    const onHashChange = (url: string) => {
      const savedTop = scrollPositions.get(url);
      if (savedTop !== undefined) {
        getMainContentElement()?.scrollTo({
          top: savedTop,
          behavior: 'smooth',
        });
        return;
      }

      const blockId = new URL(url, window.location.origin).hash.slice(1);
      const blockEl = blockId ? document.getElementById(blockId) : null;
      if (blockEl) {
        scrollBlockIntoView(blockEl);
        highlightBlock(blockEl);
      }
    };

    Router.events.on('hashChangeComplete', onHashChange);

    return () => {
      Router.events.off('hashChangeComplete', onHashChange);
    };
  }, []);
};

export const highlightBlock = (blockEl: HTMLElement) => {
  blockEl.classList.add(BLOCK_HIGHLIGHT_CLASS);
  setTimeout(() => {
    blockEl.classList.remove(BLOCK_HIGHLIGHT_CLASS);
  }, HIGHLIGHT_DURATION);
};

/**
 * Navigates in the same tab when the link points to a document of this
 * instance, remembering the scroll position so the back button returns to it.
 * Returns false for any other link, so it keeps opening in a new tab.
 */
export const navigateToDocLink = (href: string): boolean => {
  const link = getDocLink(href);
  if (!link) {
    return false;
  }

  const target = `/docs/${link.docId}/${link.blockId ? `#${link.blockId}` : ''}`;
  const container = getMainContentElement();
  if (container) {
    scrollPositions.set(Router.asPath, container.scrollTop);
  }
  scrollPositions.delete(target);

  void Router.push(target, undefined, { scroll: false });

  return true;
};

export const followDocLink = (event: MouseEvent): boolean => {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return false;
  }

  const anchor = (event.target as Element | null)?.closest('a[href]');
  if (
    !(anchor instanceof HTMLAnchorElement) ||
    !navigateToDocLink(anchor.href)
  ) {
    return false;
  }

  event.preventDefault();
  return true;
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
