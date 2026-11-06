import { CommentsExtension, ThreadData } from '@blocknote/core/comments';
import { announce } from '@react-aria/live-announcer';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { validate as uuidValidate } from 'uuid';

import { DocsBlockNoteEditor } from '@/docs/doc-editor/types';

import { DocsThreadStore } from '../api/DocsThreadStore';

const OPEN_TIMEOUT = 10000;

export const findThreadOfComment = (
  threads: Map<string, ThreadData>,
  commentId: string,
) =>
  [...threads.values()].find(({ comments }) =>
    comments.some(({ id }) => id === commentId),
  );

/**
 * Index of the comment among the `.bn-thread-comment` elements of a selected
 * thread: BlockNote inserts a "resolved by" pseudo comment, mirrored from
 * its `Comments` component, and collapses nothing once the thread is selected.
 */
export const getCommentElementIndex = (
  thread: ThreadData,
  commentId: string,
) => {
  const index = thread.comments.findIndex(({ id }) => id === commentId);
  if (
    index === -1 ||
    !thread.resolved ||
    !thread.resolvedUpdatedAt ||
    !thread.resolvedBy
  ) {
    return index;
  }

  const resolvedAt = thread.resolvedUpdatedAt.getTime();
  const resolvedIndex =
    thread.comments.findLastIndex(
      ({ createdAt }) => resolvedAt > createdAt.getTime(),
    ) + 1;

  return index >= resolvedIndex ? index + 1 : index;
};

const getCommentElement = (thread: ThreadData, commentId: string) => {
  const threadEl = document.querySelector<HTMLElement>('.bn-thread.selected');
  const commentEl = threadEl?.querySelectorAll<HTMLElement>(
    '.bn-thread-comments .bn-thread-comment',
  )[getCommentElementIndex(thread, commentId)];

  return threadEl && commentEl ? { threadEl, commentEl } : undefined;
};

const scrollCommentIntoView = ({
  threadEl,
  commentEl,
}: {
  threadEl: HTMLElement;
  commentEl: HTMLElement;
}) => {
  // The floating thread scrolls by itself, scrolling it directly avoids
  // interrupting the scroll of the editor to the thread
  const behavior: ScrollBehavior = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches
    ? 'auto'
    : 'smooth';

  if (threadEl.scrollHeight > threadEl.clientHeight) {
    threadEl.scrollTo({
      top:
        commentEl.getBoundingClientRect().top -
        threadEl.getBoundingClientRect().top +
        threadEl.scrollTop,
      behavior,
    });
  } else {
    commentEl.scrollIntoView({ behavior, block: 'nearest' });
  }
};

/**
 * The email of a mention in a comment links to the doc with the comment id
 * as hash: open its thread, then scroll to the comment.
 * The thread can only be opened once it is loaded and its mark is positioned
 * in the editor, both arriving asynchronously.
 */
export const useOpenCommentAnchor = (
  editor: DocsBlockNoteEditor,
  threadStore: DocsThreadStore,
  enabled: boolean,
) => {
  // The hash changes without remounting the editor when a link to a comment
  // is opened while its doc is already displayed
  const { t } = useTranslation();
  const [hash, setHash] = useState(() => window.location.hash);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const commentId = hash.slice(1);
    const comments = editor.getExtension(CommentsExtension);

    if (!enabled || !comments || !uuidValidate(commentId)) {
      return;
    }

    let thread: ThreadData | undefined;
    const cleanups: (() => void)[] = [];
    const cleanup = () => cleanups.splice(0).forEach((fn) => fn());

    const scrollToComment = () => {
      // The thread may have changed since it was opened, the comments are
      // rendered from the current one
      const current = thread && threadStore.getThreads().get(thread.id);
      const elements = current && getCommentElement(current, commentId);
      if (!elements) {
        return false;
      }

      cleanup();
      scrollCommentIntoView(elements);
      // The focus stays in the editor: the opened thread is not otherwise
      // told to the screen readers
      announce(
        t('Comment opened', {
          description:
            'Screen reader announcement when a link opens a comment thread',
        }),
        'polite',
      );
      return true;
    };

    const openThread = () => {
      if (thread) {
        return;
      }

      const found = findThreadOfComment(threadStore.getThreads(), commentId);
      if (!found || !comments.store.state.threadPositions.has(found.id)) {
        return;
      }

      thread = found;
      comments.selectThread(thread.id, true);

      if (!scrollToComment()) {
        const observer = new MutationObserver(scrollToComment);
        observer.observe(document.body, { childList: true, subtree: true });
        cleanups.push(() => observer.disconnect());
      }
    };

    cleanups.push(threadStore.subscribe(openThread));
    cleanups.push(comments.store.subscribe(openThread));
    const timeoutId = setTimeout(cleanup, OPEN_TIMEOUT);
    cleanups.push(() => clearTimeout(timeoutId));

    openThread();

    return cleanup;
  }, [editor, threadStore, enabled, hash, t]);
};
