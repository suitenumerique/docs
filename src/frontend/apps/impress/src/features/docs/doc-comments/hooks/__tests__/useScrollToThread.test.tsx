import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocsThreadStore } from '@/docs/doc-comments/api/DocsThreadStore';
import type { DocsBlockNoteEditor } from '@/docs/doc-editor/types';

import { parseThreadHash, useScrollToThread } from '../useScrollToThread';

const THREAD_ID = '3b2f9b0e-6d0e-4f6e-9a54-0e5d3a7a1c11';
const COMMENT_ID = 'a3a5bd0d-4b2f-4a7c-9c1e-5a5e8e1d2f10';

describe('parseThreadHash', () => {
  it('parses a thread and a comment', () => {
    expect(
      parseThreadHash(`#thread=${THREAD_ID},comment=${COMMENT_ID}`),
    ).toEqual({ threadId: THREAD_ID, commentId: COMMENT_ID });
  });

  it('parses a thread without comment', () => {
    expect(parseThreadHash(`#thread=${THREAD_ID}`)).toEqual({
      threadId: THREAD_ID,
      commentId: undefined,
    });
  });

  it.each(['', '#', `#${COMMENT_ID}`, '#thread=', '#thread=a&comment=b'])(
    'ignores %s',
    (hash) => {
      expect(parseThreadHash(hash)).toBeUndefined();
    },
  );
});

describe('useScrollToThread', () => {
  const selectThread = vi.fn();
  const subscribeComments = vi.fn(() => vi.fn());
  const subscribeThreads = vi.fn(() => vi.fn());
  const comments = {
    selectThread,
    store: {
      state: { threadPositions: new Map<string, unknown>() },
      subscribe: subscribeComments,
    },
  };
  const editor = {
    getExtension: () => comments,
  } as unknown as DocsBlockNoteEditor;

  const createThreadStore = (threads: Map<string, unknown>) =>
    ({
      getThreads: () => threads,
      subscribe: subscribeThreads,
    }) as unknown as DocsThreadStore;

  beforeEach(() => {
    vi.clearAllMocks();
    comments.store.state.threadPositions = new Map();
    window.location.hash = `#thread=${THREAD_ID},comment=${COMMENT_ID}`;
  });

  afterEach(() => {
    window.location.hash = '';
    document.body.innerHTML = '';
  });

  it('selects the thread once its comment mark and its data are loaded', () => {
    comments.store.state.threadPositions.set(THREAD_ID, { from: 1, to: 2 });
    const threadStore = createThreadStore(
      new Map([[THREAD_ID, { comments: [{ id: COMMENT_ID }] }]]),
    );

    renderHook(() => useScrollToThread(editor, threadStore, true));

    expect(selectThread).toHaveBeenCalledWith(THREAD_ID);
  });

  it('waits for the thread to be loaded', () => {
    comments.store.state.threadPositions.set(THREAD_ID, { from: 1, to: 2 });
    const threadStore = createThreadStore(new Map());

    renderHook(() => useScrollToThread(editor, threadStore, true));

    expect(selectThread).not.toHaveBeenCalled();
    expect(subscribeThreads).toHaveBeenCalled();
    expect(subscribeComments).toHaveBeenCalled();
  });

  it('does nothing when comments are disabled', () => {
    comments.store.state.threadPositions.set(THREAD_ID, { from: 1, to: 2 });
    const threadStore = createThreadStore(
      new Map([[THREAD_ID, { comments: [{ id: COMMENT_ID }] }]]),
    );

    renderHook(() => useScrollToThread(editor, threadStore, false));

    expect(selectThread).not.toHaveBeenCalled();
  });

  it('does nothing without a thread hash', () => {
    window.location.hash = `#${COMMENT_ID}`;
    comments.store.state.threadPositions.set(THREAD_ID, { from: 1, to: 2 });
    const threadStore = createThreadStore(
      new Map([[THREAD_ID, { comments: [{ id: COMMENT_ID }] }]]),
    );

    renderHook(() => useScrollToThread(editor, threadStore, true));

    expect(selectThread).not.toHaveBeenCalled();
  });

  it('scrolls the thread to the comment', async () => {
    comments.store.state.threadPositions.set(THREAD_ID, { from: 1, to: 2 });
    const threadStore = createThreadStore(
      new Map([
        [THREAD_ID, { comments: [{ id: 'first' }, { id: COMMENT_ID }] }],
      ]),
    );

    document.body.innerHTML = `
      <div class="bn-thread selected" id="thread">
        <div class="bn-thread-comment"></div>
        <div class="bn-thread-comment" id="target"></div>
      </div>`;
    const thread = document.getElementById('thread')!;
    Object.defineProperty(thread, 'scrollHeight', { value: 1000 });
    Object.defineProperty(thread, 'clientHeight', { value: 100 });
    thread.style.overflowY = 'auto';
    const scrollTo = vi.fn();
    thread.scrollTo = scrollTo;

    renderHook(() => useScrollToThread(editor, threadStore, true));

    await vi.waitFor(() => expect(scrollTo).toHaveBeenCalled());
  });
});
