import { ThreadData } from '@blocknote/core/comments';
import { announce } from '@react-aria/live-announcer';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DocsBlockNoteEditor } from '@/docs/doc-editor/types';

import { DocsThreadStore } from '../../api/DocsThreadStore';
import {
  findThreadOfComment,
  getCommentElementIndex,
  useOpenCommentAnchor,
} from '../useOpenCommentAnchor';

vi.mock('@react-aria/live-announcer', () => ({ announce: vi.fn() }));

const stubReducedMotion = (matches: boolean) =>
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation(() => ({ matches })),
  );

const THREAD_ID = '9c8d3c2e-7a35-4d0e-9f53-0e3b8f8b1a01';
const COMMENT_ID = '56de07e8-0c1a-4d1c-b5c4-348fec9a56e8';

const comment = (id: string, createdAt: string) => ({
  type: 'comment' as const,
  id,
  userId: 'user',
  body: [],
  createdAt: new Date(createdAt),
  updatedAt: new Date(createdAt),
  reactions: [],
  metadata: {},
});

const buildThread = (overrides: Partial<ThreadData> = {}): ThreadData => ({
  type: 'thread',
  id: THREAD_ID,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  comments: [comment('first', '2026-01-01'), comment(COMMENT_ID, '2026-01-03')],
  resolved: false,
  metadata: {},
  ...overrides,
});

/**
 * A minimal subscribable value, standing for the thread store and the store
 * of the comments extension.
 */
const createSubscribable = <T>(initial: T) => {
  const listeners = new Set<() => void>();
  const subscribable = {
    state: initial,
    subscribe: vi.fn((listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    set: (state: T) => {
      subscribable.state = state;
      listeners.forEach((listener) => listener());
    },
    listeners,
  };
  return subscribable;
};

const setup = ({ enabled = true }: { enabled?: boolean } = {}) => {
  const threads = createSubscribable(new Map<string, ThreadData>());
  const positions = createSubscribable({
    threadPositions: new Map<string, { from: number; to: number }>(),
  });
  const selectThread = vi.fn();

  const editor = {
    getExtension: () => ({ store: positions, selectThread }),
  } as unknown as DocsBlockNoteEditor;
  const threadStore = {
    getThreads: () => threads.state,
    subscribe: threads.subscribe,
  } as unknown as DocsThreadStore;

  const hook = renderHook(() =>
    useOpenCommentAnchor(editor, threadStore, enabled),
  );

  return { threads, positions, selectThread, hook };
};

const renderSelectedThread = (commentCount: number) => {
  document.body.innerHTML = `
    <div class="bn-thread selected">
      <div class="bn-thread-comments">
        ${'<div class="bn-thread-comment"></div>'.repeat(commentCount)}
      </div>
    </div>`;
  return [...document.querySelectorAll<HTMLElement>('.bn-thread-comment')];
};

describe('findThreadOfComment', () => {
  it('returns the thread holding the comment', () => {
    const thread = buildThread();
    const threads = new Map([[thread.id, thread]]);

    expect(findThreadOfComment(threads, COMMENT_ID)).toBe(thread);
    expect(findThreadOfComment(threads, 'unknown')).toBeUndefined();
  });
});

describe('getCommentElementIndex', () => {
  it('returns the index of the comment in an open thread', () => {
    expect(getCommentElementIndex(buildThread(), COMMENT_ID)).toBe(1);
    expect(getCommentElementIndex(buildThread(), 'unknown')).toBe(-1);
  });

  it('skips the "resolved by" pseudo comment inserted before the comment', () => {
    const thread = buildThread({
      resolved: true,
      resolvedBy: 'user',
      resolvedUpdatedAt: new Date('2026-01-02'),
    });

    expect(getCommentElementIndex(thread, 'first')).toBe(0);
    expect(getCommentElementIndex(thread, COMMENT_ID)).toBe(2);
  });
});

describe('useOpenCommentAnchor', () => {
  beforeEach(() => {
    window.location.hash = `#${COMMENT_ID}`;
    stubReducedMotion(false);
  });

  afterEach(() => {
    window.location.hash = '';
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.mocked(announce).mockClear();
  });

  it('opens the thread once loaded and positioned, then scrolls to the comment', async () => {
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const { threads, positions, selectThread } = setup();

    threads.set(new Map([[THREAD_ID, buildThread()]]));
    expect(selectThread).not.toHaveBeenCalled();

    positions.set({
      threadPositions: new Map([[THREAD_ID, { from: 1, to: 5 }]]),
    });
    expect(selectThread).toHaveBeenCalledExactlyOnceWith(THREAD_ID, true);

    const commentEls = renderSelectedThread(2);

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
    });
    expect(scrollIntoView.mock.contexts[0]).toBe(commentEls[1]);
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'nearest',
    });
    expect(announce).toHaveBeenCalledExactlyOnceWith(
      'Comment opened',
      'polite',
    );

    // Done: it stops listening to the stores
    expect(threads.listeners.size).toBe(0);
    expect(positions.listeners.size).toBe(0);
  });

  it.each([
    ['the hash is not a comment id', 'heading', true],
    ['the comments are not shown', COMMENT_ID, false],
  ])('does nothing when %s', (_, hash, enabled) => {
    window.location.hash = `#${hash}`;
    const { threads, positions, selectThread } = setup({ enabled });

    threads.set(new Map([[THREAD_ID, buildThread()]]));
    positions.set({
      threadPositions: new Map([[THREAD_ID, { from: 1, to: 5 }]]),
    });

    expect(selectThread).not.toHaveBeenCalled();
    expect(threads.subscribe).not.toHaveBeenCalled();
  });

  it('scrolls without animation when the user prefers reduced motion', async () => {
    stubReducedMotion(true);
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const { threads, positions } = setup();

    threads.set(new Map([[THREAD_ID, buildThread()]]));
    positions.set({
      threadPositions: new Map([[THREAD_ID, { from: 1, to: 5 }]]),
    });
    renderSelectedThread(2);

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'auto',
      block: 'nearest',
    });
  });

  it('scrolls from the current thread when a comment was deleted meanwhile', async () => {
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const { threads, positions } = setup();
    const thread = buildThread();

    threads.set(new Map([[THREAD_ID, thread]]));
    positions.set({
      threadPositions: new Map([[THREAD_ID, { from: 1, to: 5 }]]),
    });

    // The first comment is deleted before the thread is rendered
    threads.set(
      new Map([[THREAD_ID, buildThread({ comments: [thread.comments[1]] })]]),
    );
    const commentEls = renderSelectedThread(1);

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
    });
    expect(scrollIntoView.mock.contexts[0]).toBe(commentEls[0]);
  });

  it('opens the comment of a new hash without remounting', () => {
    const otherCommentId = '0b6f5f1c-3d0e-4f43-8d57-0d3a1c0f2a11';
    const otherThreadId = 'f3a4c2a0-6a49-4a53-9a0d-1f6a2e7b9c33';
    const { threads, positions, selectThread } = setup();
    const otherThread = buildThread({
      id: otherThreadId,
      comments: [comment(otherCommentId, '2026-01-04')],
    });

    threads.set(
      new Map([
        [THREAD_ID, buildThread()],
        [otherThreadId, otherThread],
      ]),
    );
    positions.set({
      threadPositions: new Map([
        [THREAD_ID, { from: 1, to: 5 }],
        [otherThreadId, { from: 6, to: 9 }],
      ]),
    });
    expect(selectThread).toHaveBeenLastCalledWith(THREAD_ID, true);

    act(() => {
      window.location.hash = `#${otherCommentId}`;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    expect(selectThread).toHaveBeenLastCalledWith(otherThreadId, true);
  });

  it('stops listening when unmounted', () => {
    const { threads, positions, hook } = setup();

    hook.unmount();

    expect(threads.listeners.size).toBe(0);
    expect(positions.listeners.size).toBe(0);
  });
});
