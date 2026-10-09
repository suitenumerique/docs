import { CommentsExtension } from '@blocknote/core/comments';
import { useEffect } from 'react';

import type { DocsThreadStore } from '@/docs/doc-comments/api/DocsThreadStore';
import type { DocsBlockNoteEditor } from '@/docs/doc-editor/types';

const OBSERVER_TIMEOUT = 10000;
const COMMENT_SCROLL_MARGIN_TOP = 8;

const THREAD_HASH_REGEX = /^#thread=([\w-]+)(?:,comment=([\w-]+))?$/;

/**
 * Parse the hash of the link sent by email when a comment is added to a
 * thread: `#thread=<threadId>,comment=<commentId>`.
 * It cannot be a block id, so it is not handled by `useScrollToBlockAnchor`.
 */
export const parseThreadHash = (hash: string) => {
  const match = THREAD_HASH_REGEX.exec(hash);

  if (!match) {
    return undefined;
  }

  return { threadId: match[1], commentId: match[2] };
};

const isScrollable = (el: HTMLElement) => {
  const { overflowY } = window.getComputedStyle(el);

  return (
    (overflowY === 'auto' || overflowY === 'scroll') &&
    el.scrollHeight > el.clientHeight
  );
};

/**
 * Scroll the closest scrollable ancestor of the comment (the floating thread
 * or the comments sidebar), and only it, so the editor keeps showing the
 * commented text.
 */
const scrollCommentIntoView = (commentEl: HTMLElement) => {
  let container = commentEl.parentElement;

  while (container && !isScrollable(container)) {
    container = container.parentElement;
  }

  if (!container) {
    return;
  }

  const top =
    commentEl.getBoundingClientRect().top -
    container.getBoundingClientRect().top +
    container.scrollTop -
    COMMENT_SCROLL_MARGIN_TOP;

  container.scrollTo({ top, behavior: 'smooth' });
};

/**
 * Wait for the selected thread to be rendered, and scroll to the comment.
 * The selected thread is the only one with the `selected` class.
 */
const scrollToComment = (commentIndex: number) => {
  const getCommentEl = () =>
    document
      .querySelectorAll<HTMLElement>('.bn-thread.selected .bn-thread-comment')
      .item(commentIndex);

  const scroll = (commentEl: HTMLElement) =>
    requestAnimationFrame(() => scrollCommentIntoView(commentEl));

  const existingEl = getCommentEl();
  if (existingEl) {
    scroll(existingEl);
    return () => {};
  }

  const observer = new MutationObserver(() => {
    const commentEl = getCommentEl();

    if (commentEl) {
      clearTimeout(timeoutId);
      observer.disconnect();
      scroll(commentEl);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  const timeoutId = setTimeout(() => observer.disconnect(), OBSERVER_TIMEOUT);

  return () => {
    clearTimeout(timeoutId);
    observer.disconnect();
  };
};

/**
 * Hook that opens the comment thread targeted by the URL hash
 * (`#thread=<threadId>,comment=<commentId>`): the editor scrolls to the
 * commented text, the thread is opened, and scrolled to the comment.
 * The threads and the comment marks are loaded asynchronously, so we wait,
 * for a limited time, for both to be available.
 */
export const useScrollToThread = (
  editor: DocsBlockNoteEditor,
  threadStore: DocsThreadStore,
  enabled: boolean,
) => {
  useEffect(() => {
    const target = parseThreadHash(window.location.hash);

    if (!enabled || !target) {
      return;
    }

    const { threadId, commentId } = target;
    const comments = editor.getExtension(CommentsExtension);

    if (!comments) {
      return;
    }

    let cancelScrollToComment = () => {};
    let unsubscribeComments = () => {};
    let unsubscribeThreads = () => {};
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const stopWaiting = () => {
      clearTimeout(timeoutId);
      unsubscribeComments();
      unsubscribeThreads();
    };

    const openThread = () => {
      const thread = threadStore.getThreads().get(threadId);

      if (!thread || !comments.store.state.threadPositions.has(threadId)) {
        return;
      }

      stopWaiting();
      comments.selectThread(threadId);

      const commentIndex = thread.comments.findIndex(
        (comment) => comment.id === commentId,
      );
      if (commentIndex > 0) {
        cancelScrollToComment = scrollToComment(commentIndex);
      }
    };

    unsubscribeComments = comments.store.subscribe(openThread);
    unsubscribeThreads = threadStore.subscribe(openThread);
    timeoutId = setTimeout(stopWaiting, OBSERVER_TIMEOUT);
    openThread();

    return () => {
      stopWaiting();
      cancelScrollToComment();
    };
  }, [editor, threadStore, enabled]);
};
